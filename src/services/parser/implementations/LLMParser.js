import ParserInterface from '../interfaces/ParserInterface';
import CommandSchema from '../models/CommandSchema';

/**
 * Implementazione del parser basata su LLM
 * Questa classe estende l'interfaccia ParserInterface e implementa
 * l'analisi dei comandi usando un modello linguistico.
 * NOTA: Questa è una versione placeholder che sarà implementata in futuro.
 */
export class LLMParser extends ParserInterface {
  constructor(config = {}) {
    super();
    
    this.config = {
      apiKey: config.apiKey || null,
      endpoint: config.endpoint || 'https://api.openai.com/v1',
      model: config.model || 'gpt-3.5-turbo',
      maxTokens: config.maxTokens || 150,
      temperature: config.temperature || 0.2,
      ...config
    };
    
    // Flag per indicare se il parser è stato configurato correttamente
    this.isConfigured = !!this.config.apiKey;
  }
  
  /**
   * Analizza un comando in linguaggio naturale
   * @param {string} text - Il testo del comando da analizzare
   * @returns {Promise<CommandSchema>} - Oggetto schema del comando analizzato
   */
  async parseCommand(text) {
    // Se non configurato, ritorna uno schema vuoto
    if (!this.isConfigured) {
      return new CommandSchema({
        parsingMetadata: {
          method: 'llm',
          rawText: text,
          ambiguities: ['LLM non configurato'],
          missingInfo: ['API key']
        }
      });
    }
    
    try {
      // Qui in futuro ci sarà l'integrazione con l'API di un LLM
      // Per ora, ritorniamo un placeholder
      
      return new CommandSchema({
        intent: null,
        confidence: 0,
        parsingMetadata: {
          method: 'llm',
          rawText: text,
          ambiguities: ['Funzionalità non ancora implementata'],
          missingInfo: []
        },
        isValid: false
      });
      
      /* 
      IMPLEMENTAZIONE FUTURA:
      
      const prompt = this._buildPrompt(text);
      
      const response = await fetch(this.config.endpoint + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Errore API LLM: ${data.error?.message || response.statusText}`);
      }
      
      // Estrai la risposta strutturata
      const structuredResponse = this._parseResponse(data.choices[0].message.content);
      
      // Converti in CommandSchema
      return this._toCommandSchema(structuredResponse, text);
      */
    } catch (error) {
      console.error('Errore durante l\'analisi con LLM:', error);
      
      return new CommandSchema({
        parsingMetadata: {
          method: 'llm',
          rawText: text,
          ambiguities: [`Errore: ${error.message}`],
          missingInfo: []
        }
      });
    }
  }
  
  /**
   * Verifica se il parser può gestire un determinato tipo di comando
   * @param {string} text - Il testo del comando da analizzare
   * @returns {Promise<boolean>} - true se il parser può gestire questo tipo di comando
   */
  async canHandle(text) {
    // Il LLMParser può gestire comandi solo se configurato
    return this.isConfigured;
  }
  
  /**
   * Restituisce il livello di confidenza con cui il parser può interpretare questo comando
   * @param {string} text - Il testo del comando da analizzare
   * @returns {Promise<number>} - Valore di confidenza tra 0.0 e 1.0
   */
  async getConfidence(text) {
    // Se non configurato, confidenza zero
    if (!this.isConfigured) return 0.0;
    
    // Il LLM dovrebbe essere migliore per comandi complessi
    const complexity = this._estimateComplexity(text);
    return Math.min(0.8, 0.5 + (complexity * 0.3)); // Max 0.8 per dare priorità al RegexParser quando funziona bene
  }
  
  /**
   * Stima la complessità di un comando
   * @private
   * @param {string} text - Il testo da analizzare
   * @returns {number} - Valore di complessità tra 0.0 e 1.0
   */
  _estimateComplexity(text) {
    // Euristiche semplici per stimare la complessità
    const wordCount = text.split(/\s+/).length;
    const hasQuestion = text.includes('?');
    const hasMultipleRequests = text.includes(' e ') || text.includes(' poi ');
    
    let complexity = 0.0;
    
    // Aumenta la complessità in base a fattori
    if (wordCount > 15) complexity += 0.3;
    if (wordCount > 25) complexity += 0.3;
    if (hasQuestion) complexity += 0.2;
    if (hasMultipleRequests) complexity += 0.2;
    
    return Math.min(1.0, complexity);
  }
  
  /**
   * Costruisce il prompt per l'LLM
   * @private
   * @param {string} text - Il testo del comando
   * @returns {Object} - Oggetto con prompt di sistema e utente
   */
  _buildPrompt(text) {
    // Qui si definisce il prompt per l'LLM
    const systemPrompt = `
    Sei un assistente specializzato nell'analisi di comandi in linguaggio naturale per un'app di calendario.
    Il tuo compito è interpretare i comandi dell'utente e convertirli in una struttura dati JSON.
    
    I comandi possono essere di tipo:
    - create: creazione di un nuovo evento
    - read: lettura/visualizzazione di eventi esistenti
    - update: modifica di un evento esistente
    - delete: eliminazione di un evento
    - query: interrogazione sul calendario
    
    Rispondi SOLO con un oggetto JSON valido che include:
    - intent: l'intento del comando (create, read, update, delete, query)
    - confidence: il tuo livello di confidenza nell'interpretazione (0.0-1.0)
    - eventData: {title, description, location, participants[]}
    - timeData: {startDate, startTime, endDate, endTime, duration, recurrence}
    - queryData: {timeRange: {start, end}, searchTerm, filterType, limit}
    - ambiguities: array di possibili ambiguità nell'interpretazione
    - missingInfo: array di informazioni mancanti necessarie
    
    Per le date e gli orari, usa il formato ISO.
    `;
    
    return {
      system: systemPrompt,
      user: text
    };
  }
  
  /**
   * Analizza la risposta dell'LLM
   * @private
   * @param {string} response - Risposta testuale dall'LLM
   * @returns {Object} - Oggetto strutturato con i dati del comando
   */
  _parseResponse(response) {
    try {
      // Estrai il JSON dalla risposta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Formato di risposta non valido');
    } catch (error) {
      console.error('Errore nel parsing della risposta LLM:', error);
      return {
        intent: null,
        confidence: 0,
        ambiguities: ['Errore nel parsing della risposta'],
        missingInfo: []
      };
    }
  }
  
  /**
   * Converte la risposta strutturata in un CommandSchema
   * @private
   * @param {Object} structuredResponse - Risposta strutturata
   * @param {string} originalText - Testo originale del comando
   * @returns {CommandSchema} - Schema del comando
   */
  _toCommandSchema(structuredResponse, originalText) {
    const { 
      intent, 
      confidence, 
      eventData = {}, 
      timeData = {}, 
      queryData = {},
      ambiguities = [], 
      missingInfo = [] 
    } = structuredResponse;
    
    // Converti stringhe di data in oggetti Date
    const convertDates = (data) => {
      const result = { ...data };
      
      ['startDate', 'endDate', 'startTime', 'endTime'].forEach(field => {
        if (result[field] && typeof result[field] === 'string') {
          result[field] = new Date(result[field]);
        }
      });
      
      if (result.timeRange) {
        if (result.timeRange.start && typeof result.timeRange.start === 'string') {
          result.timeRange.start = new Date(result.timeRange.start);
        }
        if (result.timeRange.end && typeof result.timeRange.end === 'string') {
          result.timeRange.end = new Date(result.timeRange.end);
        }
      }
      
      return result;
    };
    
    const processedTimeData = convertDates(timeData);
    const processedQueryData = convertDates(queryData);
    
    // Crea lo schema
    const schema = new CommandSchema({
      intent,
      confidence: confidence || 0,
      eventData,
      timeData: processedTimeData,
      queryData: processedQueryData,
      parsingMetadata: {
        method: 'llm',
        rawText: originalText,
        ambiguities,
        missingInfo
      }
    });
    
    // Verifica la validità
    schema.isValid = schema.validate();
    
    return schema;
  }
}

export default LLMParser;