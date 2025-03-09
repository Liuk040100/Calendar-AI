import { useState } from 'react';
import { parseCommand } from '../services/parser/core/parserService';
import { createEvent, getEvents, updateEvent, deleteEvent } from '../services/calendar/calendarService';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const CommandInput = () => {
  const [command, setCommand] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('info');
  const [suggestions, setSuggestions] = useState([]);
  const [debugInfo, setDebugInfo] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [queryResults, setQueryResults] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // Per azioni su eventi multipli

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!command.trim()) {
      setFeedback('Inserisci un comando');
      setFeedbackType('info');
      setSuggestions([]);
      setQueryResults(null);
      setPendingAction(null);
      return;
    }
    
    setProcessing(true);
    setFeedback('Elaborazione comando...');
    setFeedbackType('info');
    setSuggestions([]);
    setQueryResults(null);
    setPendingAction(null);
    
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
          await handleCreateEvent(result);
          break;
        }
        
        case 'read':
        case 'query': {
          await handleQueryEvents(result);
          break;
        }
        
        case 'update': {
          await handleUpdateEvent(result);
          break;
        }
        
        case 'delete': {
          await handleDeleteEvent(result);
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

  // Handler per la creazione di eventi
  const handleCreateEvent = async (result) => {
    try {
      // Verifica che ci siano i dati minimi necessari
      if (!result.title) {
        setFeedback('Titolo dell\'evento mancante');
        setFeedbackType('error');
        setSuggestions(['Specifica un titolo per l\'evento']);
        return;
      }
      
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
  };

  // Handler per la query di eventi
  const handleQueryEvents = async (result) => {
    try {
      // Calcola intervallo di ricerca in base ai dati
      const today = new Date();
      let timeMin, timeMax;
      
      // Se abbiamo un intervallo temporale specifico nella query
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
      
      console.log('Query eventi dal', timeMin, 'al', timeMax);
      
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
            (event.summary && event.summary.toLowerCase().includes(searchTermLower)) ||
            (event.description && event.description.toLowerCase().includes(searchTermLower))
          );
        }
        
        if (filteredEvents.length > 0) {
          // Check se c'era un intento nascosto di eliminazione
          const originalCommand = result.originalText || command;
          const hasDeleteIntent = /elimina|rimuovi|cancella/i.test(originalCommand);
          
          if (hasDeleteIntent && !result.searchTerm && !command.toLowerCase().includes('mostra')) {
            setFeedback(`Trovati ${filteredEvents.length} eventi. Seleziona quale eliminare:`);
            setFeedbackType('info');
            setPendingAction('delete');
          } else {
            setFeedback(`Trovati ${filteredEvents.length} eventi`);
            setFeedbackType('success');
            setPendingAction(null);
          }
          
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
  };

  // Handler per l'aggiornamento di eventi
  const handleUpdateEvent = async (result) => {
    try {
      // Trova gli eventi che corrispondono al titolo
      const today = new Date();
      const oneMonthLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      let timeMin = today;
      let timeMax = oneMonthLater;
      
      // Se è specificata una data, usa quella per restringere la ricerca
      if (result.date) {
        const date = new Date(result.date);
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        timeMin = startOfDay;
        timeMax = endOfDay;
      }
      
      const existingEvents = await getEvents(
        timeMin.toISOString(),
        timeMax.toISOString(),
        10
      );
      
      // Filtra per trovare l'evento con il titolo corrispondente
      const matchingEvents = existingEvents.filter(event => 
        event.summary && event.summary.toLowerCase().includes(result.title.toLowerCase())
      );
      
      if (matchingEvents.length === 0) {
        setFeedback(`Nessun evento trovato con il titolo "${result.title}"`);
        setFeedbackType('error');
        return;
      }
      
      if (matchingEvents.length > 1) {
        setFeedback(`Trovati più eventi con titolo simile a "${result.title}". Seleziona quale modificare:`);
        setFeedbackType('info');
        setQueryResults({
          type: 'multiple_match',
          events: matchingEvents
        });
        setPendingAction('update');
        return;
      }
      
      // Se c'è un solo evento corrispondente, aggiornalo
      const eventToUpdate = matchingEvents[0];
      await updateSelectedEvent(eventToUpdate, result);
      
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dell\'evento:', error);
      setFeedback('Errore durante l\'aggiornamento: ' + error.message);
      setFeedbackType('error');
    }
  };

  // Helper per aggiornare un evento selezionato
  const updateSelectedEvent = async (eventToUpdate, result) => {
    try {
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
          result.date || new Date(eventToUpdate.start.dateTime),
          result.time || new Date(eventToUpdate.start.dateTime)
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
      setPendingAction(null);
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dell\'evento:', error);
      setFeedback('Errore durante l\'aggiornamento: ' + error.message);
      setFeedbackType('error');
      setPendingAction(null);
    }
  };

  // Handler per l'eliminazione di eventi
  const handleDeleteEvent = async (result) => {
    try {
      // Cerca eventi esistenti con il titolo specificato
      const today = new Date();
      const oneMonthLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      let timeMin = today;
      let timeMax = oneMonthLater;
      
      // Se è specificata una data, usa quella per restringere la ricerca
      if (result.date) {
        const date = new Date(result.date);
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        timeMin = startOfDay;
        timeMax = endOfDay;
      }
      
      const existingEvents = await getEvents(
        timeMin.toISOString(),
        timeMax.toISOString(),
        10
      );
      
      // Filtra per trovare eventi con il titolo corrispondente
      const matchingEvents = existingEvents.filter(event => 
        event.summary && event.summary.toLowerCase().includes(result.title.toLowerCase())
      );
      
      if (matchingEvents.length === 0) {
        setFeedback(`Nessun evento trovato con il titolo "${result.title}"`);
        setFeedbackType('error');
        return;
      }
      
      if (matchingEvents.length > 1) {
        setFeedback(`Trovati più eventi con titolo simile a "${result.title}". Seleziona quale eliminare:`);
        setFeedbackType('info');
        setQueryResults({
          type: 'multiple_match',
          events: matchingEvents
        });
        setPendingAction('delete');
        return;
      }
      
      // Se c'è un solo evento corrispondente, eliminalo
      const eventToDelete = matchingEvents[0];
      await deleteSelectedEvent(eventToDelete);
      
    } catch (error) {
      console.error('Errore durante l\'eliminazione dell\'evento:', error);
      setFeedback('Errore durante l\'eliminazione: ' + error.message);
      setFeedbackType('error');
    }
  };

  // Helper per eliminare un evento selezionato
  const deleteSelectedEvent = async (eventToDelete) => {
    try {
      // Esegui l'eliminazione
      await deleteEvent(eventToDelete.id);
      
      setFeedback(`Evento "${eventToDelete.summary}" eliminato con successo!`);
      setFeedbackType('success');
      setQueryResults(null);
      setPendingAction(null);
    } catch (error) {
      console.error('Errore durante l\'eliminazione dell\'evento:', error);
      setFeedback('Errore durante l\'eliminazione: ' + error.message);
      setFeedbackType('error');
      setPendingAction(null);
    }
  };

  // Handler per selezionare un evento dalla lista di risultati
  const handleEventSelect = async (event) => {
    if (!pendingAction) return;
    
    if (pendingAction === 'delete') {
      await deleteSelectedEvent(event);
    } else if (pendingAction === 'update') {
      // Qui possiamo solo preparare l'evento per la modifica,
      // ma avremmo bisogno di ulteriori input dall'utente.
      // Per semplicità, aggiorniamo solo l'ora se era specificata nel comando originale
      const result = await parseCommand(command);
      await updateSelectedEvent(event, result);
    }
  };

  // Funzione helper per combinare data e ora
  const combineDateTime = (date, time) => {
    if (!date) return new Date().toISOString();
    
    // Assicurati che sia un oggetto Date
    const result = new Date(date);
    
    if (time) {
      // Se time è un oggetto Date
      if (time instanceof Date) {
        result.setHours(
          time.getHours(),
          time.getMinutes(),
          0,
          0
        );
      } 
      // Se time è una stringa ISO
      else if (typeof time === 'string') {
        const timeDate = new Date(time);
        result.setHours(
          timeDate.getHours(),
          timeDate.getMinutes(),
          0,
          0
        );
      }
    } else {
      // Default: mezzogiorno
      result.setHours(12, 0, 0, 0);
    }
    
    return result.toISOString();
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
            {queryResults.type === 'query' && pendingAction === 'delete' && 'Seleziona l\'evento da eliminare:'}
            {queryResults.type === 'query' && pendingAction === 'update' && 'Seleziona l\'evento da modificare:'}
            {queryResults.type === 'query' && !pendingAction && 'Eventi trovati:'}
            {queryResults.type === 'created' && 'Evento creato:'}
            {queryResults.type === 'updated' && 'Evento aggiornato:'}
            {queryResults.type === 'multiple_match' && pendingAction === 'delete' && 'Seleziona l\'evento da eliminare:'}
            {queryResults.type === 'multiple_match' && pendingAction === 'update' && 'Seleziona l\'evento da modificare:'}
          </h4>
          
          {queryResults.events.map((event, index) => (
            <div 
              key={index} 
              className={`event-item ${pendingAction ? 'selectable' : ''}`}
              onClick={pendingAction ? () => handleEventSelect(event) : undefined}
              style={pendingAction ? { cursor: 'pointer' } : {}}
            >
              <div className="event-title">{event.summary}</div>
              <div className="event-time">
                {formatDateTime(event.start.dateTime || event.start.date)}
              </div>
              {event.location && (
                <div className="event-location">
                  Luogo: {event.location}
                </div>
              )}
              {pendingAction && (
                <div className="event-action-hint" style={{ color: '#4285f4', marginTop: '5px', fontSize: '0.9em' }}>
                  {pendingAction === 'delete' ? 'Clicca per eliminare' : 'Clicca per modificare'}
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
          <li>"Ricordami di comprare il pane stasera alle 18"</li>
          <li>"Mostra appuntamenti di domani"</li>
          <li>"Quali eventi ho questa settimana?"</li>
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