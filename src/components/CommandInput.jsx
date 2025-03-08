import { useState } from 'react';
import { parseCommand } from '../services/parser/commandParser';
import { createEvent, getEvents } from '../services/calendar/calendarService';

const CommandInput = () => {
  const [command, setCommand] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('info'); // 'info', 'success', 'error'

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!command.trim()) {
      setFeedback('Inserisci un comando');
      setFeedbackType('info');
      return;
    }
    
    setProcessing(true);
    setFeedback('Elaborazione comando...');
    setFeedbackType('info');
    
    try {
      // Analizza il comando
      const parsedCommand = parseCommand(command);
      
      if (!parsedCommand.valid) {
        setFeedback('Non ho capito il comando. Prova ad esempio: "Crea riunione domani alle 15"');
        setFeedbackType('error');
        return;
      }
      
      // Gestisci diversi tipi di azioni
      switch (parsedCommand.action) {
        case 'create': {
          // Prepara i dati dell'evento
          const startTime = new Date();
          if (parsedCommand.date) {
            startTime.setFullYear(
              parsedCommand.date.getFullYear(),
              parsedCommand.date.getMonth(),
              parsedCommand.date.getDate()
            );
          }
          
          if (parsedCommand.time) {
            startTime.setHours(
              parsedCommand.time.getHours(),
              parsedCommand.time.getMinutes(),
              0, 0
            );
          }
          
          // Crea l'evento
          const endTime = new Date(startTime);
          endTime.setHours(endTime.getHours() + 1); // Default: durata 1 ora
          
          const eventData = {
            summary: parsedCommand.title,
            description: parsedCommand.description || '',
            start: {
              dateTime: startTime.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            end: {
              dateTime: endTime.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
          };
          
          await createEvent(eventData);
          setFeedback('Evento creato con successo!');
          setFeedbackType('success');
          break;
        }
        
        case 'read': {
          // Per ora impostato solo come feedback
          setFeedback('Funzionalità di visualizzazione eventi in arrivo');
          setFeedbackType('info');
          break;
        }
        
        default:
          setFeedback('Questa funzionalità non è ancora implementata');
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
      
      <div className="command-examples">
        <h3>Esempi di comandi:</h3>
        <ul>
          <li>"Crea riunione con Mario domani alle 10"</li>
          <li>"Aggiungi appuntamento dal dentista venerdì alle 15:30"</li>
          <li>"Mostra appuntamenti di lunedì"</li>
        </ul>
      </div>
    </div>
  );
};

export default CommandInput;