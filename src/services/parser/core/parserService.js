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
      
      // Valida l'intent
      const validationResult = intentValidator.validate(commandSchema);
      
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
  const result = await parserService.parseCommand(text);
  
  // Per compatibilità con il vecchio codice, adattiamo il risultato
  if (result.validationResult.isValid) {
    const { commandSchema } = result;
    
    // Converti lo schema nel formato atteso dal codice legacy
    return {
      action: commandSchema.intent,
      date: commandSchema.timeData.startDate,
      time: commandSchema.timeData.startTime,
      title: commandSchema.eventData.title,
      description: commandSchema.eventData.description,
      valid: true
    };
  } else {
    // Se non valido, restituisci un oggetto compatibile con struttura minima
    return {
      action: null,
      date: null,
      time: null,
      title: null,
      description: null,
      valid: false,
      errors: result.validationResult.errors
    };
  }
};