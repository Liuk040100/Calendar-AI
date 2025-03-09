import parserFactory from './ParserFactory';
import intentValidator from '../validators/IntentValidator';

/**
 * Servizio principale per il parsing dei comandi
 * Questo servizio funge da facciata per l'interazione con il sistema di parsing
 */
export class ParserService {
  constructor() {
    this.factory = parserFactory;
  }
  
  /**
   * Analizza un comando in linguaggio naturale
   * @param {string} text - Il testo del comando da analizzare
   * @returns {Promise<Object>} - Risultato dell'analisi contenente lo schema e la validazione
   */
  async parseCommand(text) {
    try {
      // Ottieni lo schema del comando dal factory
      const commandSchema = await this.factory.parseCommand(text);
      
      // Aggiungi log di debug
      console.debug('Schema comando generato:', commandSchema);
      
      // Valida l'intent
      const validationResult = intentValidator.validate(commandSchema);
      
      // Aggiungi log di debug
      console.debug('Risultato validazione:', validationResult);
      
      // Restituisci sia lo schema che il risultato della validazione
      return {
        commandSchema,
        validationResult
      };
    } catch (error) {
      console.error('Errore durante il parsing del comando:', error);
      
      // Restituisci un errore strutturato
      return {
        commandSchema: null,
        validationResult: {
          isValid: false,
          errors: [`Errore durante l'analisi: ${error.message}`],
          suggestions: ['Prova a riformulare il comando in modo più semplice']
        }
      };
    }
  }
  
  /**
   * Configura il servizio di parsing
   * @param {Object} config - Configurazione del servizio
   */
  configure(config = {}) {
    this.factory.updateConfig(config);
  }
  
  /**
   * Attiva/disattiva l'uso esclusivo del parser regex
   * @param {boolean} useRegexOnly - Se true, usa solo regex
   */
  setUseRegexOnly(useRegexOnly) {
    this.factory.updateConfig({ useRegexOnly });
  }
  
  /**
   * Configura l'integrazione con LLM
   * @param {Object} llmConfig - Configurazione LLM
   */
  configureLLM(llmConfig) {
    this.factory.updateConfig({ 
      useRegexOnly: false,
      llm: llmConfig 
    });
  }
  
  /**
   * Ottiene lo stato corrente del servizio
   * @returns {Object} - Stato del servizio
   */
  getStatus() {
    return {
      ...this.factory.getStatus(),
      isReady: true
    };
  }
}

// Esporta un'istanza singleton
const parserService = new ParserService();
export default parserService;

// Esporta la funzione parseCommand direttamente per compatibilità con il vecchio codice
export const parseCommand = async (text) => {
  try {
    console.debug('parseCommand chiamato con:', text);
    const result = await parserService.parseCommand(text);
    console.debug('Risultato ottenuto dal parserService:', result);
    
    // Se abbiamo un risultato completo
    if (result && result.commandSchema && result.validationResult) {
      const { commandSchema, validationResult } = result;
      
      // Per compatibilità con il vecchio codice, adattiamo il risultato
      if (validationResult.isValid) {
        // Estrai i valori in modo sicuro con valori predefiniti
        const intent = commandSchema.intent || null;
        const startDate = commandSchema.timeData && commandSchema.timeData.startDate || null;
        const startTime = commandSchema.timeData && commandSchema.timeData.startTime || null;
        const title = commandSchema.eventData && commandSchema.eventData.title || null;
        const description = commandSchema.eventData && commandSchema.eventData.description || null;
        
        console.debug('Restituisco oggetto valido:', {
          action: intent,
          date: startDate,
          time: startTime,
          title,
          description
        });
        
        return {
          action: intent,
          date: startDate,
          time: startTime,
          title,
          description,
          valid: true
        };
      } else {
        // Se non valido, restituisci un oggetto compatibile con struttura minima
        const errors = validationResult.errors || ['Comando non valido'];
        
        console.debug('Restituisco oggetto non valido con errori:', errors);
        
        return {
          action: null,
          date: null,
          time: null,
          title: null,
          description: null,
          valid: false,
          errors
        };
      }
    } else {
      // Fallback se qualcosa è andato storto
      console.debug('Risultato incompleto dal parser, restituisco fallback');
      
      return {
        action: null,
        date: null,
        time: null,
        title: null,
        description: null,
        valid: false,
        errors: ['Errore durante l\'analisi del comando']
      };
    }
  } catch (error) {
    console.error('Errore in parseCommand:', error);
    
    return {
      action: null,
      date: null,
      time: null,
      title: null,
      description: null,
      valid: false,
      errors: [`Errore: ${error.message}`]
    };
  }
};