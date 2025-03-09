import ParserInterface from '../interfaces/ParserInterface';
import CommandSchema from '../models/CommandSchema';
import config from '../utils/config';

/**
 * Implementazione minimale del parser basata su espressioni regolari
 * Questa classe offre un fallback basilare per quando LLM non è disponibile
 */
export class RegexParser extends ParserInterface {
  constructor() {
    super();
    this.keywordMap = config.keywords || {
      create: ['crea', 'aggiungi', 'nuovo', 'pianifica', 'programma', 'organizza', 'fissa', 'inserisci'],
      read: ['mostra', 'visualizza', 'vedi', 'dammi', 'elenca', 'trova', 'cerca'],
      update: ['modifica', 'aggiorna', 'cambia', 'sposta', 'posticipa', 'anticipa', 'rinvia', 'rinomina'],
      delete: ['elimina', 'cancella', 'rimuovi', 'togli']
    };
  }
  
  /**
   * Analizza un comando in linguaggio naturale
   * @param {string} text - Il testo del comando da analizzare
   * @returns {Promise<CommandSchema>} - Schema del comando analizzato
   */
  async parseCommand(text) {
    try {
      const lowerText = text.toLowerCase();
      
      // Determina l'intento dal primo verbo
      const intent = this._determineIntent(lowerText);
      
      // Estrai data e ora dal testo
      const { startDate, startTime } = this._extractDateTime(text);
      
      // Estrai il titolo dell'evento
      const title = this._extractTitle(text, intent);
      
      // Crea lo schema
      const schema = new CommandSchema({
        intent,
        confidence: 0.6, // Confidenza moderata per il parser regex
        eventData: {
          title,
          description: '', // Il parser regex base non estrae descrizioni
          location: ''
        },
        timeData: {
          startDate,
          startTime
        },
        queryData: intent === 'read' || intent === 'query' ? this._extractQueryData(text, startDate) : {},
        parsingMetadata: {
          method: 'regex',
          rawText: text,
          ambiguities: [],
          missingInfo: []
        }
      });
      
      // Imposta validità
      schema.isValid = schema.validate();
      
      return schema;
    } catch (error) {
      console.error('Errore durante il parsing con regex:', error);
      
      // In caso di errore, restituisci uno schema vuoto
      return new CommandSchema({
        parsingMetadata: {
          method: 'regex',
          rawText: text,
          ambiguities: [`Errore: ${error.message}`],
          missingInfo: []
        }
      });
    }
  }
  
  /**
   * Verifica se il parser può gestire un determinato tipo di comando
   * @param {string} text - Il testo del comando
   * @returns {Promise<boolean>} - true se può gestirlo
   */
  async canHandle(text) {
    return true; // Il parser regex può sempre provare a gestire i comandi
  }
  
  /**
   * Calcola il livello di confidenza per il parsing del comando
   * @param {string} text - Il testo del comando
   * @returns {Promise<number>} - Valore tra 0 e 1
   */
  async getConfidence(text) {
    // Calcola la confidenza in base alla presenza di parole chiave conosciute
    const lowerText = text.toLowerCase();
    let confidence = 0.4; // Base
    
    // Verifica se c'è un intento chiaro
    if (this._determineIntent(lowerText)) {
      confidence += 0.2;
    }
    
    // Verifica se c'è una data/ora
    if (this._hasDateTime(lowerText)) {
      confidence += 0.2;
    }
    
    return Math.min(confidence, 0.8); // Massimo 0.8 per il parser regex
  }
  
  /**
   * Determina l'intento del comando
   * @private
   * @param {string} text - Testo del comando in minuscolo
   * @returns {string|null} - Intento rilevato o null
   */
  _determineIntent(text) {
    // Controlla ogni categoria di parole chiave
    for (const [intent, keywords] of Object.entries(this.keywordMap)) {
      for (const keyword of keywords) {
        // Verifica che la parola chiave sia all'inizio o preceduta da spazio
        const regex = new RegExp(`(^|\\s)${keyword}(\\s|$)`, 'i');
        if (regex.test(text)) {
          return intent;
        }
      }
    }
    
    // Default: se contiene domande come "quali", "quando", ecc., considera come read/query
    if (/quali|quando|come|dove|cosa|chi/i.test(text)) {
      return 'query';
    }
    
    return null;
  }
  
  /**
   * Verifica se il testo contiene riferimenti a date/ore
   * @private
   * @param {string} text - Testo del comando
   * @returns {boolean} - true se contiene date/ore
   */
  _hasDateTime(text) {
    const dateTimePatterns = [
      /\b(oggi|domani|dopodomani|ieri)\b/i,
      /\b(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)\b/i,
      /\b(alle|ore|le)\s+\d{1,2}/i,
      /\b\d{1,2}:\d{2}\b/,
      /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/
    ];
    
    return dateTimePatterns.some(pattern => pattern.test(text));
  }
  
  /**
   * Estrae data e ora dal testo
   * @private
   * @param {string} text - Testo del comando
   * @returns {Object} - Oggetto con startDate e startTime
   */
  _extractDateTime(text) {
    const result = {
      startDate: null,
      startTime: null
    };
    
    // Pattern per date relative
    const relativeDatePattern = /\b(oggi|domani|dopodomani|ieri|l'altro ieri)\b/i;
    const relativeDateMatch = text.match(relativeDatePattern);
    
    if (relativeDateMatch) {
      const today = new Date();
      
      switch (relativeDateMatch[1].toLowerCase()) {
        case 'oggi':
          result.startDate = today;
          break;
        case 'domani':
          result.startDate = new Date(today);
          result.startDate.setDate(today.getDate() + 1);
          break;
        case 'dopodomani':
          result.startDate = new Date(today);
          result.startDate.setDate(today.getDate() + 2);
          break;
        case 'ieri':
          result.startDate = new Date(today);
          result.startDate.setDate(today.getDate() - 1);
          break;
        case "l'altro ieri":
          result.startDate = new Date(today);
          result.startDate.setDate(today.getDate() - 2);
          break;
      }
    }
    
    // Pattern per giorni della settimana
    const weekdayPattern = /\b(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)( prossimo| scorso)?\b/i;
    const weekdayMatch = text.match(weekdayPattern);
    
    if (weekdayMatch && !result.startDate) {
      const weekdays = {
        'lunedì': 1, 'lunedi': 1,
        'martedì': 2, 'martedi': 2,
        'mercoledì': 3, 'mercoledi': 3,
        'giovedì': 4, 'giovedi': 4,
        'venerdì': 5, 'venerdi': 5,
        'sabato': 6,
        'domenica': 0
      };
      
      const today = new Date();
      const targetDay = weekdays[weekdayMatch[1].toLowerCase()];
      const isPast = weekdayMatch[2] && weekdayMatch[2].trim() === 'scorso';
      const isFuture = weekdayMatch[2] && weekdayMatch[2].trim() === 'prossimo';
      
      if (targetDay !== undefined) {
        const currentDay = today.getDay();
        let daysToAdd;
        
        if (isPast) {
          // Trova il giorno della settimana precedente
          daysToAdd = targetDay - currentDay - 7;
        } else if (isFuture || targetDay <= currentDay) {
          // Trova il giorno della settimana successiva
          daysToAdd = targetDay - currentDay + 7;
        } else {
          // Trova il giorno della settimana corrente
          daysToAdd = targetDay - currentDay;
        }
        
        // Normalizziamo per evitare di avanzare di 7 giorni se non necessario
        daysToAdd = daysToAdd % 7;
        if (daysToAdd === 0 && !isPast && !isFuture) {
          // Se è lo stesso giorno e non è specificato prossimo/scorso, considera il prossimo
          daysToAdd = 7;
        }
        
        result.startDate = new Date(today);
        result.startDate.setDate(today.getDate() + daysToAdd);
      }
    }
    
    // Pattern per ore (formato 24h o 12h con am/pm)
    const timePattern = /\b(alle|ore|le)\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?\b/i;
    const timeMatch = text.match(timePattern);
    
    if (timeMatch) {
      let hours = parseInt(timeMatch[2], 10);
      const minutes = parseInt(timeMatch[3] || '0', 10);
      const ampm = timeMatch[4] ? timeMatch[4].toLowerCase() : null;
      
      // Gestione am/pm
      if (ampm === 'pm' && hours < 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }
      
      const now = new Date();
      result.startTime = new Date(now);
      result.startTime.setHours(hours, minutes, 0, 0);
    }
    
    // Pattern per date esplicite (gg/mm/yyyy o gg/mm)
    const datePattern = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
    const dateMatch = text.match(datePattern);
    
    if (dateMatch && !result.startDate) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1; // I mesi in JS sono 0-based
      const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : new Date().getFullYear();
      
      // Gestione anno a 2 cifre
      const fullYear = year < 100 ? (year < 50 ? 2000 + year : 1900 + year) : year;
      
      result.startDate = new Date(fullYear, month, day);
    }
    
    return result;
  }
  
  /**
   * Estrae il titolo dell'evento dal testo
   * @private
   * @param {string} text - Testo del comando
   * @param {string} intent - Intento rilevato
   * @returns {string} - Titolo estratto
   */
  _extractTitle(text, intent) {
    if (!intent || intent === 'read' || intent === 'query') {
      return '';
    }
    
    // Cerca di identificare la parte del testo che contiene il titolo
    // Rimuovi le parole chiave dell'intento all'inizio
    const keywords = this.keywordMap[intent] || [];
    let cleanedText = text;
    
    for (const keyword of keywords) {
      const regex = new RegExp(`^\\s*${keyword}\\b`, 'i');
      cleanedText = cleanedText.replace(regex, '').trim();
    }
    
    // Rimuovi date e ore comuni
    cleanedText = cleanedText
      .replace(/\b(oggi|domani|dopodomani|ieri|l'altro ieri)\b/gi, '')
      .replace(/\b(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)( prossimo| scorso)?\b/gi, '')
      .replace(/\b(alle|ore|le)\s+\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?\b/gi, '')
      .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '')
      .replace(/\b(appuntamento|evento|incontro|riunione)\s+/gi, ''); // Rimuovi parole generiche
    
    // Rimuovi preposizioni all'inizio
    cleanedText = cleanedText.replace(/^(per|con|da|di|a|al|alla|allo|all'|agli|alle)\s+/i, '');
    
    // Estrai le prime N parole (massimo 5) come titolo
    const words = cleanedText.trim().split(/\s+/);
    const titleWords = words.slice(0, Math.min(5, words.length));
    
    return titleWords.join(' ').trim();
  }
  
  /**
   * Estrae dati di query per intent read/query
   * @private
   * @param {string} text - Testo del comando
   * @param {Date} startDate - Data iniziale già estratta
   * @returns {Object} - Dati di query
   */
  _extractQueryData(text, startDate) {
    const queryData = {
      timeRange: {
        start: null,
        end: null
      },
      searchTerm: null,
      filterType: null,
      limit: 10
    };
    
    // Se abbiamo già una data, usiamola come inizio del range
    if (startDate) {
      queryData.timeRange.start = new Date(startDate);
      queryData.timeRange.start.setHours(0, 0, 0, 0);
      
      // Imposta la fine del range alla fine della giornata
      queryData.timeRange.end = new Date(startDate);
      queryData.timeRange.end.setHours(23, 59, 59, 999);
    }
    
    // Pattern per periodi
    const periodPatterns = [
      { pattern: /\bquesta settimana\b/i, days: 7 },
      { pattern: /\bprossima settimana\b/i, days: 14 },
      { pattern: /\bquesto mese\b/i, days: 30 },
      { pattern: /\bprossimo mese\b/i, days: 60 }
    ];
    
    for (const { pattern, days } of periodPatterns) {
      if (pattern.test(text)) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        queryData.timeRange.start = today;
        
        const end = new Date(today);
        end.setDate(today.getDate() + days);
        end.setHours(23, 59, 59, 999);
        
        queryData.timeRange.end = end;
        break;
      }
    }
    
    // Cerca termini di ricerca (dopo "con", "riguardo a", ecc.)
    const searchTermPatterns = [
      /\bcon\s+([^,]+)/i,
      /\briguardo\s+(?:a|al|alla|allo|all')\s+([^,]+)/i,
      /\bsu\s+([^,]+)/i,
      /\bdi\s+([^,]+)/i
    ];
    
    for (const pattern of searchTermPatterns) {
      const match = text.match(pattern);
      if (match) {
        queryData.searchTerm = match[1].trim();
        break;
      }
    }
    
    return queryData;
  }
}

// Esporta un'istanza singleton
const regexParser = new RegexParser();
export default regexParser;