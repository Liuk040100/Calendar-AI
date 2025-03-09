import { useState } from 'react';
import { parseCommand } from '../services/parser/core/parserService';
import { createEvent, getEvents, updateEvent, deleteEvent } from '../services/calendar/calendarService';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const CommandInput = () => {
  const [command, setCommand] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('info'); // 'info', 'success', 'error'
  const [suggestions, setSuggestions] = useState([]);
  const [debugInfo, setDebugInfo] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [queryResults, setQueryResults] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!command.trim()) {
      setFeedback('Inserisci un comando');
      setFeedbackType('info');
      setSuggestions([]);
      setQueryResults(null);
      return;
    }
    
    setProcessing(true);
    setFeedback('Elaborazione comando...');
    setFeedbackType('info');
    setSuggestions([]);
    setQueryResults(null);
    
    try {
      console.log('Elaborazione comando:', command);
      
      // Analizza il comando con il parser
      const result = await parseCommand(command);
      
      // Aggiorna info di debug
      setDebugInfo(JSON.stringify(result, null, 2));
      
      console.log('Risultato parser:', result);
      
      // Verifica che il risultato sia valido
      if (!result || result.valid === undefined) {
        throw new Error('Formato di risposta del parser non valido');
      }
      
      // Se il comando non è valido, mostra feedback e suggerimenti
      if (!result.valid) {
        const errorMsg = result.errors && result.errors.length > 0 
          ? result.errors.join('. ') 
          : 'Comando non riconosciuto';
        
        setFeedback(errorMsg);
        setFeedbackType('error');
        
        // Se ci sono suggerimenti nel nuovo formato, usali
        if (result.suggestions && result.suggestions.length > 0) {
          setSuggestions(result.suggestions);
        } else {
          setSuggestions([
            'Prova a essere più specifico',
            'Includi data e ora nel comando',
            'Specifica chiaramente l\'azione (crea, mostra, ecc.)'
          ]);
        }
        
        setProcessing(false);
        return;
      }
      
      // Gestisci diversi tipi di azioni
      switch (result.action) {
        case 'create': {
          try {
            // Crea un evento per Google Calendar
            const eventData = {
              summary: result.title,
              description: result.description || '',
              location: result.location || '',
              start: {
                dateTime: combineDateTime(result.date, result.time),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
              },
              end: {
                // Per ora impostiamo 1 ora di durata come default
                dateTime: addHours(combineDateTime(result.date, result.time), 1),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
              }
            };
            
            // Crea l'evento
            const createdEvent = await createEvent(eventData);
            setFeedback(`Evento "${result.title}" creato con successo!`);
            setFeedbackType('success');
            
            // Mostra dettagli dell'evento creato
            setQueryResults({
              type: 'created',
              events: [createdEvent]
            });
          } catch (error) {
            console.error('Errore durante la creazione dell\'evento:', error);
            setFeedback('Errore durante la creazione dell\'evento: ' + error.message);
            setFeedbackType('error');
          }
          break;
        }
        
        case 'read':
        case 'query': {
          try {
            // Calcola intervallo di ricerca in base alla data
            const today = new Date();
            let timeMin, timeMax;
            
            if (result.timeRange && result.timeRange.start) {
              timeMin = new Date(result.timeRange.start);
            } else if (result.date) {
              timeMin = new Date(result.date);
            } else {
              timeMin = today;
            }
            
            if (result.timeRange && result.timeRange.end) {
              timeMax = new Date(result.timeRange.end);
            } else if (result.date) {
              // Imposta fine giornata per la data specificata
              timeMax = new Date(new Date(result.date).setHours(23, 59, 59, 999));
            } else {
              // Una settimana se non specificata
              timeMax = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            }
            
            // Ottieni gli eventi
            const events = await getEvents(
              timeMin.toISOString(), 
              timeMax.toISOString(), 
              result.limit || 10
            );
            
            if (events && events.length > 0) {
              // Filtra gli eventi se c'è un termine di ricerca
              let filteredEvents = events;
              if (result.searchTerm) {
                const searchTermLower = result.searchTerm.toLowerCase();
                filteredEvents = events.filter(event => 
                  event.summary.toLowerCase().includes(searchTermLower) ||
                  (event.description && event.description.toLowerCase().includes(searchTermLower))
                );
              }
              
              if (filteredEvents.length > 0) {
                setFeedback(`Trovati ${filteredEvents.length} eventi`);
                setFeedbackType('success');
                
                // Visualizza i risultati
                setQueryResults({
                  type: 'query',
                  events: filteredEvents,
                  timeRange: {
                    start: timeMin,
                    end: timeMax
                  }
                });
              } else {
                setFeedback('Nessun evento corrispondente ai criteri di ricerca');
                setFeedbackType('info');
              }
            } else {
              setFeedback('Nessun evento trovato per il periodo specificato');
              setFeedbackType('info');
            }
          } catch (error) {
            console.error('Errore durante la ricerca degli eventi:', error);
            setFeedback('Errore durante la ricerca: ' + error.message);
            setFeedbackType('error');
          }
          break;
        }
        
        case 'update': {
          try {
            // Cerca eventi esistenti con il titolo specificato
            const today = new Date();
            const oneMonthLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
            const existingEvents = await getEvents(
              today.toISOString(),
              oneMonthLater.toISOString(),
              10
            );
            
            // Filtra per trovare l'evento con il titolo corrispondente
            const matchingEvents = existingEvents.filter(event => 
              event.summary.toLowerCase().includes(result.title.toLowerCase())
            );
            
            if (matchingEvents.length === 0) {
              setFeedback(`Nessun evento trovato con il titolo "${result.title}"`);
              setFeedbackType('error');
              break;
            }
            
            if (matchingEvents.length > 1) {
              setFeedback(`Trovati più eventi con titolo simile a "${result.title}". Specifica meglio quale evento vuoi modificare.`);
              setFeedbackType('info');
              setQueryResults({
                type: 'multiple_match',
                events: matchingEvents
              });
              break;
            }
            
            // Prendi il primo evento corrispondente
            const eventToUpdate = matchingEvents[0];
            
            // Prepara i dati per l'aggiornamento
            const updatedEventData = {
              ...eventToUpdate,
              summary: result.title || eventToUpdate.summary
            };
            
            // Aggiorna descrizione se specificata
            if (result.description) {
              updatedEventData.description = result.description;
            }
            
            // Aggiorna location se specificata
            if (result.location) {
              updatedEventData.location = result.location;
            }
            
            // Aggiorna data e ora se specificate
            if (result.date || result.time) {
              const newStartDateTime = combineDateTime(
                result.date || extractDate(eventToUpdate.start.dateTime),
                result.time || extractTime(eventToUpdate.start.dateTime)
              );
              
              updatedEventData.start = {
                dateTime: newStartDateTime,
                timeZone: eventToUpdate.start.timeZone
              };
              
              // Mantieni la stessa durata
              const originalDuration = new Date(eventToUpdate.end.dateTime) - new Date(eventToUpdate.start.dateTime);
              updatedEventData.end = {
                dateTime: new Date(new Date(newStartDateTime).getTime() + originalDuration).toISOString(),
                timeZone: eventToUpdate.end.timeZone
              };
            }
            
            // Esegui l'aggiornamento
            const updatedEvent = await updateEvent(eventToUpdate.id, updatedEventData);
            
            setFeedback(`Evento "${updatedEvent.summary}" aggiornato con successo!`);
            setFeedbackType('success');
            
            // Mostra dettagli dell'evento aggiornato
            setQueryResults({
              type: 'updated',
              events: [updatedEvent]
            });
          } catch (error) {
            console.error('Errore durante l\'aggiornamento dell\'evento:', error);
            setFeedback('Errore durante l\'aggiornamento: ' + error.message);
            setFeedbackType('error');
          }
          break;
        }
        
        case 'delete': {
          try {
            // Cerca eventi esistenti con il titolo specificato
            const today = new Date();
            const oneMonthLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
            const existingEvents = await getEvents(
              today.toISOString(),
              oneMonthLater.toISOString(),
              10
            );
            
            // Filtra per trovare l'evento con il titolo corrispondente
            const matchingEvents = existingEvents.filter(event => 
              event.summary.toLowerCase().includes(result.title.toLowerCase())
            );
            
            if (matchingEvents.length === 0) {
              setFeedback(`Nessun evento trovato con il titolo "${result.title}"`);
              setFeedbackType('error');
              break;
            }
            
            if (matchingEvents.length > 1) {
              setFeedback(`Trovati più eventi con titolo simile a "${result.title}". Specifica meglio quale evento vuoi eliminare.`);
              setFeedbackType('info');
              setQueryResults({
                type: 'multiple_match',
                events: matchingEvents
              });
              break;
            }
            
            // Prendi il primo evento corrispondente
            const eventToDelete = matchingEvents[0];
            
            // Esegui l'eliminazione
            await deleteEvent(eventToDelete.id);
            
            setFeedback(`Evento "${eventToDelete.summary}" eliminato con successo!`);
            setFeedbackType('success');
          } catch (error) {
            console.error('Errore durante l\'eliminazione dell\'evento:', error);
            setFeedback('Errore durante l\'eliminazione: ' + error.message);
            setFeedbackType('error');
          }
          break;
        }
        
        default:
          setFeedback('Funzionalità non riconosciuta o non ancora implementata');
          setFeedbackType('info');
          break;
      }
      
    } catch (error) {
      console.error('Errore durante l\'elaborazione del comando:', error);
      setFeedback('Si è verificato un errore: ' + error.message);
      setFeedbackType('error');
      setDebugInfo(JSON.stringify({ error: error.message, stack: error.stack }, null, 2));
    } finally {
      setProcessing(false);
    }
  };

  // Funzione helper per combinare data e ora
  const combineDateTime = (date, time) => {
    if (!date) return new Date().toISOString();
    
    const result = new Date(date);
    
    if (time) {
      const timeDate = new Date(time);
      result.setHours(
        timeDate.getHours(),
        timeDate.getMinutes(),
        0,
        0
      );
    } else {
      // Default: mezzogiorno
      result.setHours(12, 0, 0, 0);
    }
    
    return result.toISOString();
  };

  // Funzione helper per estrarre la data da una stringa ISO
  const extractDate = (isoString) => {
    const date = new Date(isoString);
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  // Funzione helper per estrarre l'ora da una stringa ISO
  const extractTime = (isoString) => {
    return new Date(isoString);
  };

  // Funzione helper per aggiungere ore a una data
  const addHours = (dateString, hours) => {
    const date = new Date(dateString);
    date.setHours(date.getHours() + hours);
    return date.toISOString();
  };

  // Funzione helper per formattare la data in formato italiano
  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    
    try {
      const date = new Date(isoString);
      return format(date, "EEEE d MMMM yyyy 'alle' HH:mm", { locale: it });
    } catch (error) {
      console.error('Errore durante la formattazione della data:', error);
      return isoString;
    }
  };

  // Toggle per la modalità debug
  const toggleDebug = () => {
    setShowDebug(!showDebug);
  };

  return (
    <div className="command-input-container">
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Es: Crea riunione domani alle 15"
            disabled={processing}
            className="command-input"
          />
          <button 
            type="submit" 
            disabled={processing || !command.trim()}
            className="submit-button"
          >
            {processing ? 'Elaborazione...' : 'Invia'}
          </button>
        </div>
      </form>
      
      {feedback && (
        <div className={`feedback ${feedbackType}`}>
          {feedback}
        </div>
      )}
      
      {suggestions.length > 0 && (
        <div className="suggestions">
          <p>Suggerimenti:</p>
          <ul>
            {suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Visualizzazione risultati query */}
      {queryResults && (
        <div className="query-results">
          <h4>
            {queryResults.type === 'query' && 'Eventi trovati'}
            {queryResults.type === 'created' && 'Evento creato'}
            {queryResults.type === 'updated' && 'Evento aggiornato'}
            {queryResults.type === 'multiple_match' && 'Eventi corrispondenti'}
          </h4>
          
          {queryResults.events.map((event, index) => (
            <div key={index} className="event-item">
              <div className="event-title">{event.summary}</div>
              <div className="event-time">
                {formatDateTime(event.start.dateTime || event.start.date)}
              </div>
              {event.location && (
                <div className="event-location">
                  Luogo: {event.location}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="command-examples">
        <h3>Esempi di comandi:</h3>
        <ul>
          <li>"Crea riunione con Mario domani alle 10"</li>
          <li>"Aggiungi appuntamento dal dentista venerdì alle 15:30"</li>
          <li>"Mostra appuntamenti di lunedì"</li>
          <li>"Quali eventi ho la prossima settimana?"</li>
          <li>"Sposta la riunione di team a giovedì alle 14"</li>
          <li>"Elimina l'appuntamento dal dentista"</li>
        </ul>
      </div>
      
      {/* Pulsante per attivare la modalità debug - visibile solo in dev */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button 
          onClick={toggleDebug} 
          style={{ 
            padding: '6px 12px', 
            backgroundColor: '#f1f3f4', 
            border: 'none', 
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          {showDebug ? 'Nascondi Debug' : 'Mostra Debug'}
        </button>
      </div>
      
      {/* Pannello di debug */}
      <div className={`debug-panel ${showDebug ? 'visible' : ''}`} style={{ display: showDebug ? 'block' : 'none' }}>
        <h4>Informazioni di Debug</h4>
        <pre className="debug-info">{debugInfo}</pre>
      </div>
    </div>
  );
};

export default CommandInput;