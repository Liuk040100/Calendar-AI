import { useState } from 'react';
import { parseCommand } from '../services/parser/core/parserService';
import { createEvent, getEvents } from '../services/calendar/calendarService';

const CommandInput = () => {
  const [command, setCommand] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('info'); // 'info', 'success', 'error'
  const [suggestions, setSuggestions] = useState([]);

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
      // Analizza il comando con il nuovo parser
      const result = await parseCommand(command);
      const { commandSchema, validationResult } = result;
      
      // Se il comando non è valido, mostra feedback e suggerimenti
      if (!validationResult.isValid) {
        setFeedback(validationResult.errors.join('. '));
        setFeedbackType('error');
        setSuggestions(validationResult.suggestions);
        setProcessing(false);
        return;
      }
      
      // Gestisci diversi tipi di azioni
      switch (commandSchema.intent) {
        case 'create': {
          try {
            // Converti lo schema in un evento Google Calendar
            const eventData = commandSchema.toGoogleCalendarEvent();
            
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
            // Converti lo schema in parametri di ricerca
            const searchParams = commandSchema.toGoogleCalendarSearchParams();
            
            // Ottieni gli eventi
            const events = await getEvents(
              searchParams.timeMin, 
              searchParams.timeMax, 
              searchParams.maxResults
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
    } finally {
      setProcessing(false);
    }
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
    </div>
  );
};

export default CommandInput;