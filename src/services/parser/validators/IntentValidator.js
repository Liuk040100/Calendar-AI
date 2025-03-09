import CommandSchema from '../models/CommandSchema';

/**
 * Validatore di intenti
 * Questa classe verifica che gli intenti riconosciuti siano validi
 * e contenengano tutte le informazioni necessarie per essere eseguiti.
 */
export class IntentValidator {
  /**
   * Verifica la validità dell'intent e suggerisce correzioni
   * @param {CommandSchema} commandSchema - Lo schema del comando da validare
   * @returns {Object} - Risultato della validazione con suggerimenti
   */
  validate(commandSchema) {
    // Verifica che lo schema non sia nullo
    if (!commandSchema) {
      return {
        isValid: false,
        errors: ['Schema del comando non valido'],
        suggestions: ['Ripeti il comando in modo più chiaro']
      };
    }
    
    // Verifica che l'intent sia specificato
    if (!commandSchema.intent) {
      return {
        isValid: false,
        errors: ['Intent non riconosciuto'],
        suggestions: [
          'Prova a iniziare il comando con una azione chiara come "crea", "mostra", "modifica" o "elimina"',
          'Esempio: "Crea riunione domani alle 15"'
        ]
      };
    }
    
    // Validazione specifica per ogni tipo di intent
    switch (commandSchema.intent) {
      case 'create':
        return this._validateCreateIntent(commandSchema);
      case 'read':
      case 'query':
        return this._validateReadIntent(commandSchema);
      case 'update':
        return this._validateUpdateIntent(commandSchema);
      case 'delete':
        return this._validateDeleteIntent(commandSchema);
      default:
        return {
          isValid: false,
          errors: [`Intent "${commandSchema.intent}" non supportato`],
          suggestions: ['I comandi supportati sono: crea, mostra, modifica, elimina']
        };
    }
  }
  
  /**
   * Valida intent di creazione evento
   * @private
   * @param {CommandSchema} schema - Schema del comando
   * @returns {Object} - Risultato della validazione
   */
  _validateCreateIntent(schema) {
    const errors = [];
    const suggestions = [];
    const missingInfo = [];
    
    // Verifica che ci sia un titolo
    if (!schema.eventData.title) {
      errors.push('Titolo dell\'evento mancante');
      suggestions.push('Specifica un titolo chiaro per l\'evento');
      missingInfo.push('title');
    }
    
    // Verifica che ci sia una data
    if (!schema.timeData.startDate) {
      errors.push('Data dell\'evento mancante');
      suggestions.push('Specifica quando si terrà l\'evento (es. "domani", "lunedì", "il 15/05")');
      missingInfo.push('date');
    }
    
    // Verifica che ci sia un'ora (non obbligatoria, ma consigliata)
    if (!schema.timeData.startTime) {
      suggestions.push('Potresti specificare anche l\'ora dell\'evento (es. "alle 15:30")');
    }
    
    // Verifica che la data non sia nel passato
    if (schema.timeData.startDate && schema.timeData.startDate < new Date()) {
      errors.push('La data specificata è nel passato');
      suggestions.push('Specifica una data futura per il nuovo evento');
    }
    
    const isValid = errors.length === 0;
    
    return {
      isValid,
      errors,
      suggestions,
      missingInfo
    };
  }
  
  /**
   * Valida intent di lettura/query eventi
   * @private
   * @param {CommandSchema} schema - Schema del comando
   * @returns {Object} - Risultato della validazione
   */
  _validateReadIntent(schema) {
    const errors = [];
    const suggestions = [];
    const missingInfo = [];
    
    // Per query, è sufficiente avere o un intervallo temporale o un termine di ricerca
    const hasTimeRange = schema.queryData.timeRange;
    const hasSearchTerm = schema.queryData.searchTerm;
    
    if (!hasTimeRange && !hasSearchTerm) {
      errors.push('Criteri di ricerca mancanti');
      suggestions.push('Specifica un periodo (es. "oggi", "questa settimana") o un termine di ricerca');
      missingInfo.push('timeRange or searchTerm');
    }
    
    const isValid = errors.length === 0;
    
    return {
      isValid,
      errors,
      suggestions,
      missingInfo
    };
  }
  
  /**
   * Valida intent di aggiornamento evento
   * @private
   * @param {CommandSchema} schema - Schema del comando
   * @returns {Object} - Risultato della validazione
   */
  _validateUpdateIntent(schema) {
    const errors = [];
    const suggestions = [];
    const missingInfo = [];
    
    // Per aggiornare serve identificare l'evento
    if (!schema.eventData.title) {
      errors.push('Non è chiaro quale evento modificare');
      suggestions.push('Specifica il titolo dell\'evento da modificare');
      missingInfo.push('event identifier');
    }
    
    // Verifica che ci sia almeno un campo da aggiornare
    const hasUpdates = schema.timeData.startDate || 
                       schema.timeData.startTime || 
                       schema.eventData.description || 
                       schema.eventData.location;
                       
    if (!hasUpdates) {
      errors.push('Non è chiaro cosa modificare nell\'evento');
      suggestions.push('Specifica cosa vuoi modificare (es. data, ora, luogo)');
      missingInfo.push('update fields');
    }
    
    const isValid = errors.length === 0;
    
    return {
      isValid,
      errors,
      suggestions,
      missingInfo
    };
  }
  
  /**
   * Valida intent di eliminazione evento
   * @private
   * @param {CommandSchema} schema - Schema del comando
   * @returns {Object} - Risultato della validazione
   */
  _validateDeleteIntent(schema) {
    const errors = [];
    const suggestions = [];
    const missingInfo = [];
    
    // Per eliminare serve identificare chiaramente l'evento
    if (!schema.eventData.title) {
      errors.push('Non è chiaro quale evento eliminare');
      suggestions.push('Specifica il titolo dell\'evento da eliminare');
      missingInfo.push('event identifier');
    }
    
    const isValid = errors.length === 0;
    
    return {
      isValid,
      errors,
      suggestions,
      missingInfo
    };
  }
}

// Esporta un'istanza singleton
const intentValidator = new IntentValidator();
export default intentValidator;