import { useState } from 'react';
import { parseCommand } from '../services/parser/core/parserService';
import { createEvent, getEvents } from '../services/calendar/calendarService';

const CommandInput = () => {
  const [command, setCommand] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('info'); // 'info', 'success', 'error'
  const [suggestions, setSuggestions] = useState([]);
  const [debugInfo, setDebugInfo] = useState('');
  const [showDebug, setShowDebug] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!command.trim()) {
      setFeedback('Inserisci un comando');
      setFeedbackType('info');
      setSuggestions([]);
      return;
    }
    
    setProcessing(true);
    setFeedback('Elaborazione comando...');
    setFeedbackType('info');
    setSuggestions([]);
    
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
            await createEvent(eventData);
            setFeedback('Evento creato con successo!');
            setFeedbackType('success');
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
            const timeMin = result.date ? new Date(result.date) : today;
            
            // Imposta fine giornata per la data specificata
            const timeMax = result.date ? 
              new Date(new Date(result.date).setHours(23, 59, 59, 999)) : 
              new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // Una settimana se non specificata
            
            // Ottieni gli eventi
            const events = await getEvents(
              timeMin.toISOString(), 
              timeMax.toISOString(), 
              10
            );
            
            if (events && events.length > 0) {
              setFeedback(`Trovati ${events.length} eventi`);
              setFeedbackType('success');
              
              // Qui in futuro si potrebbero visualizzare gli eventi trovati
            } else {
              setFeedback('Nessun evento trovato per i criteri specificati');
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
          // Per ora impostato solo come feedback
          setFeedback('Funzionalità di aggiornamento eventi in arrivo');
          setFeedbackType('info');
          break;
        }
        
        case 'delete': {
          // Per ora impostato solo come feedback
          setFeedback('Funzionalità di eliminazione eventi in arrivo');
          setFeedbackType('info');
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
      result.setHours(
        time.getHours(),
        time.getMinutes(),
        0,
        0
      );
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
      
      <div className="command-examples">
        <h3>Esempi di comandi:</h3>
        <ul>
          <li>"Crea riunione con Mario domani alle 10"</li>
          <li>"Aggiungi appuntamento dal dentista venerdì alle 15:30"</li>
          <li>"Mostra appuntamenti di lunedì"</li>
          <li>"Quali eventi ho la prossima settimana?"</li>
          <li>"Quando sono andato dal dentista l'ultima volta?"</li>
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