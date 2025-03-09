import { format, parse, isValid, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import ParserInterface from '../interfaces/ParserInterface';
import CommandSchema from '../models/CommandSchema';

/**
 * Implementazione del parser basata su regex
 * Questa classe estende l'interfaccia ParserInterface e implementa
 * l'analisi dei comandi usando espressioni regolari.
 */
export class RegexParser extends ParserInterface {
  constructor() {
    super();
    
    // Espressioni regolari per riconoscere i comandi
    this.PATTERNS = {
      CREATE: /crea|aggiungi|nuovo|pianifica|programma|organizza|fissa|inserisci/i,
      READ: /mostra|visualizza|vedi|dammi|elenca|trova|cerca|quali|quando/i,
      UPDATE: /modifica|aggiorna|cambia|sposta|posticipa|anticipa|rinvia|rinomina/i,
      DELETE: /elimina|cancella|rimuovi|togli|rimuoviamo|eliminiamo/i,
      DATE: /oggi|domani|dopodomani|ieri|l'altro ieri|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|prossim[ao]|successiv[ao]|quest[ao]|scorso|scors[ao]|il \d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/i,
      TIME: /(?:alle|ore|alle ore)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i,
      DURATION: /per (\d+) (minut[oi]|or[ae]|giorn[oi])/i,
      RECURRENCE: /ogni (giorno|settimana|mese|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)/i,
      PARTICIPANTS: /con ([\w\s,]+)/i,
      LOCATION: /(?:a|presso|in) ([^,\.]+)/i,
      RELATIVE_DATE: /(?:tra|dopo|fra) (\d+) (giorn[oi]|settiman[ae]|mes[ei])/i,
      RELATIVE_TIME_PAST: /(?:nell['a]?\s+)?ultim[ao] (\d+) (giorn[oi]|settiman[ae]|mes[ei])/i,
      TIME_RANGE_START: /da(l(l['a])?)? ([\w\s\/]+)/i,
      TIME_RANGE_END: /(?:fino )?a(l(l['a])?)? ([\w\s\/]+)/i,
      TIME_RANGE_NEXT: /prossim[ao] (settimana|mese|anno)/i,
      TIME_RANGE_LAST: /(?:nell['a]?\s+)?ultim[ao] (settimana|mese|anno)/i,
      QUERY_TERMS: /(?:riguard[ao]|su|di|che contiene|contenente) ([^,\.]+)/i
    };
    
    // Mappa per convertire i nomi dei giorni in numeri
    this.DAYS_MAP = {
      'domenica': 0, 'lunedì': 1, 'lunedi': 1, 'martedì': 2, 'martedi': 2,
      'mercoledì': 3, 'mercoledi': 3, 'giovedì': 4, 'giovedi': 4,
      'venerdì': 5, 'venerdi': 5, 'sabato': 6
    };
    
    // Mappa per la gestione delle ricorrenze
    this.RECURRENCE_MAP = {
      'giorno': 'daily',
      'settimana': 'weekly',
      'mese': 'monthly',
      'lunedì': 'weekly;BYDAY=MO',
      'martedì': 'weekly;BYDAY=TU',
      'mercoledì': 'weekly;BYDAY=WE',
      'giovedì': 'weekly;BYDAY=TH',
      'venerdì': 'weekly;BYDAY=FR',
      'sabato': 'weekly;BYDAY=SA',
      'domenica': 'weekly;BYDAY=SU'
    };
  }
  
  /**
   * Analizza un comando in linguaggio naturale
   * @param {string} text - Il testo del comando da analizzare
   * @returns {Promise<CommandSchema>} - Oggetto schema del comando analizzato
   */
  async parseCommand(text) {
    console.debug('RegexParser.parseCommand chiamato con:', text);
    
    // Inizializza uno schema comando vuoto
    const commandSchema = new CommandSchema({
      parsingMetadata: {
        method: 'regex',
        rawText: text,
        ambiguities: [],
        missingInfo: []
      }
    });
    
    // Determina l'intent del comando
    if (this.PATTERNS.CREATE.test(text)) {
      commandSchema.intent = 'create';
    } else if (this.PATTERNS.READ.test(text)) {
      commandSchema.intent = 'read';
    } else if (this.PATTERNS.UPDATE.test(text)) {
      commandSchema.intent = 'update';
    } else if (this.PATTERNS.DELETE.test(text)) {
      commandSchema.intent = 'delete';
    } else if (this._isQueryCommand(text)) {
      commandSchema.intent = 'query';
    }
    
    console.debug('Intent rilevato:', commandSchema.intent);
    
    // Se non abbiamo capito l'intent, non possiamo procedere
    if (!commandSchema.intent) {
      console.debug('Nessun intent rilevato');
      return commandSchema;
    }
    
    // Estrai i dati dell'evento in base all'intent
    if (['create', 'update', 'delete'].includes(commandSchema.intent)) {
      // Estrai titolo, partecipanti, luogo, ecc.
      this._extractEventData(text, commandSchema);
      // Estrai data, ora, durata, ricorrenza
      this._extractTimeData(text, commandSchema);
    } else {
      // È una query, estrai i parametri di ricerca
      this._extractQueryData(text, commandSchema);
    }
    
    // Verifica se lo schema è valido per l'intent corrente
    commandSchema.isValid = commandSchema.validate();
    
    // Calcola un livello di confidenza euristico
    commandSchema.confidence = this._calculateConfidence(text, commandSchema);
    
    console.debug('Schema comando finale:', JSON.stringify(commandSchema, null, 2));
    
    return commandSchema;
  }
  
  /**
   * Verifica se il parser può gestire un determinato tipo di comando
   * @param {string} text - Il testo del comando da analizzare
   * @returns {Promise<boolean>} - true se il parser può gestire questo tipo di comando
   */
  async canHandle(text) {
    // Il RegexParser può provare a gestire qualsiasi comando,
    // ma sarà più efficace su comandi semplici e diretti
    return true;
  }
  
  /**
   * Restituisce il livello di confidenza con cui il parser può interpretare questo comando
   * @param {string} text - Il testo del comando da analizzare
   * @returns {Promise<number>} - Valore di confidenza tra 0.0 e 1.0
   */
  async getConfidence(text) {
    // Analizza rapidamente il comando
    const commandSchema = await this.parseCommand(text);
    return commandSchema.confidence;
  }
  
  /**
   * Verifica se il comando è una query anziché un'operazione CRUD
   * @private
   * @param {string} text - Il testo del comando
   * @returns {boolean} - true se il comando sembra essere una query
   */
  _isQueryCommand(text) {
    // Verifica se contiene termini di query
    const hasQueryTerms = /quali|quanti|quando|dove|chi|elenca|mostra(?:mi)?|trova/i.test(text);
    
    // Verifica se contiene riferimenti temporali relativi
    const hasRelativeTime = this.PATTERNS.RELATIVE_TIME_PAST.test(text) || 
                            this.PATTERNS.TIME_RANGE_NEXT.test(text) ||
                            this.PATTERNS.TIME_RANGE_LAST.test(text);
                            
    // Verifica se è una domanda
    const isQuestion = text.trim().endsWith('?');
    
    return hasQueryTerms || hasRelativeTime || isQuestion;
  }
  
  /**
   * Estrae i dati dell'evento dal testo del comando
   * @private
   * @param {string} text - Il testo del comando
   * @param {CommandSchema} schema - Lo schema da popolare
   */
  _extractEventData(text, schema) {
    let workingText = text;
    
    // Estrai i partecipanti
    const participantsMatch = workingText.match(this.PATTERNS.PARTICIPANTS);
    if (participantsMatch) {
      const participantsText = participantsMatch[1];
      const participants = participantsText.split(/[,e]+/).map(p => p.trim()).filter(Boolean);
      schema.eventData.participants = participants;
      
      // Rimuovi i partecipanti dal testo di lavoro
      workingText = workingText.replace(participantsMatch[0], '');
    }
    
    // Estrai il luogo
    const locationMatch = workingText.match(this.PATTERNS.LOCATION);
    if (locationMatch) {
      schema.eventData.location = locationMatch[1].trim();
      
      // Rimuovi il luogo dal testo di lavoro
      workingText = workingText.replace(locationMatch[0], '');
    }
    
    // Estrai il titolo (rimuovi prima i pattern noti)
    workingText = this._removePatterns(workingText, [
      this.PATTERNS.CREATE,
      this.PATTERNS.UPDATE,
      this.PATTERNS.DELETE,
      this.PATTERNS.DATE,
      this.PATTERNS.TIME,
      this.PATTERNS.DURATION,
      this.PATTERNS.RECURRENCE
    ]);
    
    // Cerca pattern specifici per il titolo
    const titlePatterns = /(?:intitolato|chiamato|denominato|dal titolo|con titolo|su|riguardo a)\s+["']?([^"']+)["']?/i;
    const titleMatch = workingText.match(titlePatterns);
    
    if (titleMatch) {
      schema.eventData.title = titleMatch[1].trim();
    } else if (workingText.trim()) {
      // Se non c'è un pattern specifico ma c'è del testo, usa quello come titolo
      // Cerca di estrarre un titolo significativo
      const potentialTitle = this._extractMeaningfulTitle(workingText);
      if (potentialTitle) {
        schema.eventData.title = potentialTitle;
      }
    }
  }
  
  /**
   * Estrae i dati temporali dal testo del comando
        }
      }
    }
    
    // Esporta un'istanza singleton come default export
    const regexParser = new RegexParser();
    export default regexParser;
    
   * @param {CommandSchema} schema - Lo schema da popolare
   */
  _extractTimeData(text, schema) {
    // Estrai data
    const dateMatch = text.match(this.PATTERNS.DATE);
    if (dateMatch) {
      schema.timeData.startDate = this._parseDateString(dateMatch[0]);
    }
    
    // Estrai ora
    const timeMatch = text.match(this.PATTERNS.TIME);
    if (timeMatch) {
      schema.timeData.startTime = this._parseTimeString(timeMatch[0]);
    }
    
    // Estrai durata
    const durationMatch = text.match(this.PATTERNS.DURATION);
    if (durationMatch) {
      const amount = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      
      if (unit.startsWith('minut')) {
        schema.timeData.duration = amount;
      } else if (unit.startsWith('or')) {
        schema.timeData.duration = amount * 60;
      } else if (unit.startsWith('giorn')) {
        schema.timeData.duration = amount * 60 * 24;
      }
    }
    
    // Estrai ricorrenza
    const recurrenceMatch = text.match(this.PATTERNS.RECURRENCE);
    if (recurrenceMatch) {
      const recurrenceType = recurrenceMatch[1].toLowerCase();
      schema.timeData.recurrence = this.RECURRENCE_MAP[recurrenceType] || null;
    }
    
    // Estrai date relative con offset (es. "tra 3 giorni")
    const relativeDateMatch = text.match(this.PATTERNS.RELATIVE_DATE);
    if (relativeDateMatch && !dateMatch) {
      const amount = parseInt(relativeDateMatch[1], 10);
      const unit = relativeDateMatch[2].toLowerCase();
      
      const today = new Date();
      let targetDate = new Date(today);
      
      if (unit.startsWith('giorn')) {
        targetDate.setDate(today.getDate() + amount);
      } else if (unit.startsWith('settiman')) {
        targetDate.setDate(today.getDate() + (amount * 7));
      } else if (unit.startsWith('mes')) {
        targetDate.setMonth(today.getMonth() + amount);
      }
      
      schema.timeData.startDate = targetDate;
    }
  }
  
  /**
   * Estrae dati per interrogazioni/query dal testo del comando
   * @private
   * @param {string} text - Il testo del comando
   * @param {CommandSchema} schema - Lo schema da popolare
   */
  _extractQueryData(text, schema) {
    // Inizializza il range temporale
    const timeRange = {};
    
    // Gestisci intervalli temporali relativi
    const timeRangeNextMatch = text.match(this.PATTERNS.TIME_RANGE_NEXT);
    if (timeRangeNextMatch) {
      const unit = timeRangeNextMatch[1].toLowerCase();
      const today = new Date();
      const startDate = new Date(today);
      
      // Calcola inizio della prossima unità temporale
      if (unit === 'settimana') {
        // Inizio della prossima settimana (lunedì)
        const daysUntilMonday = (7 - today.getDay() + 1) % 7 || 7;
        startDate.setDate(today.getDate() + daysUntilMonday);
      } else if (unit === 'mese') {
        // Inizio del prossimo mese
        startDate.setDate(1);
        startDate.setMonth(today.getMonth() + 1);
      } else if (unit === 'anno') {
        // Inizio del prossimo anno
        startDate.setDate(1);
        startDate.setMonth(0);
        startDate.setFullYear(today.getFullYear() + 1);
      }
      
      const endDate = new Date(startDate);
      // Calcola fine della prossima unità temporale
      if (unit === 'settimana') {
        endDate.setDate(startDate.getDate() + 6); // Da lunedì a domenica
      } else if (unit === 'mese') {
        endDate.setMonth(startDate.getMonth() + 1);
        endDate.setDate(0); // Ultimo giorno del mese
      } else if (unit === 'anno') {
        endDate.setFullYear(startDate.getFullYear() + 1);
        endDate.setDate(0); // Ultimo giorno dell'anno
      }
      
      timeRange.start = startDate;
      timeRange.end = endDate;
    }
    
    // Gestisci intervalli temporali relativi al passato
    const timeRangeLastMatch = text.match(this.PATTERNS.TIME_RANGE_LAST);
    if (timeRangeLastMatch) {
      const unit = timeRangeLastMatch[1].toLowerCase();
      const today = new Date();
      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      
      const startDate = new Date(today);
      
      // Calcola inizio dell'unità temporale passata
      if (unit === 'settimana') {
        // Inizio della settimana corrente o precedente (lunedì)
        const dayOfWeek = today.getDay() || 7; // 1-7 (lun-dom)
        startDate.setDate(today.getDate() - dayOfWeek + 1 - 7);
      } else if (unit === 'mese') {
        // Inizio del mese precedente
        startDate.setDate(1);
        startDate.setMonth(today.getMonth() - 1);
      } else if (unit === 'anno') {
        // Inizio dell'anno precedente
        startDate.setDate(1);
        startDate.setMonth(0);
        startDate.setFullYear(today.getFullYear() - 1);
      }
      
      timeRange.start = startDate;
      timeRange.end = endDate;
    }
    
    // Gestisci intervalli temporali definiti esplicitamente (da/a)
    const timeRangeStartMatch = text.match(this.PATTERNS.TIME_RANGE_START);
    const timeRangeEndMatch = text.match(this.PATTERNS.TIME_RANGE_END);
    
    if (timeRangeStartMatch) {
      const startDateText = timeRangeStartMatch[3];
      const parsedStartDate = this._parseDateString(startDateText);
      if (parsedStartDate) {
        timeRange.start = parsedStartDate;
      }
    }
    
    if (timeRangeEndMatch) {
      const endDateText = timeRangeEndMatch[3];
      const parsedEndDate = this._parseDateString(endDateText);
      if (parsedEndDate) {
        timeRange.end = parsedEndDate;
        // Imposta fine giornata
        timeRange.end.setHours(23, 59, 59, 999);
      }
    }
    
    // Gestisci ricerche relative a un periodo passato (es. "ultimi 7 giorni")
    const relativeTimePastMatch = text.match(this.PATTERNS.RELATIVE_TIME_PAST);
    if (relativeTimePastMatch) {
      const amount = parseInt(relativeTimePastMatch[1], 10);
      const unit = relativeTimePastMatch[2].toLowerCase();
      
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const startDate = new Date(today);
      
      if (unit.startsWith('giorn')) {
        startDate.setDate(today.getDate() - amount);
      } else if (unit.startsWith('settiman')) {
        startDate.setDate(today.getDate() - (amount * 7));
      } else if (unit.startsWith('mes')) {
        startDate.setMonth(today.getMonth() - amount);
      }
      
      timeRange.start = startDate;
      timeRange.end = today;
    }
    
    // Estrai termini di ricerca
    const queryTermsMatch = text.match(this.PATTERNS.QUERY_TERMS);
    if (queryTermsMatch) {
      schema.queryData.searchTerm = queryTermsMatch[1].trim();
    } else {
      // Prova a estrarre un termine di ricerca dal testo rimanente
      const cleanedText = this._removePatterns(text, [
        this.PATTERNS.READ,
        this.PATTERNS.DATE,
        this.PATTERNS.TIME,
        this.PATTERNS.TIME_RANGE_NEXT,
        this.PATTERNS.TIME_RANGE_LAST,
        this.PATTERNS.RELATIVE_TIME_PAST,
        this.PATTERNS.TIME_RANGE_START,
        this.PATTERNS.TIME_RANGE_END
      ]);
      
      // Rimuovi parole di domanda e comuni per query
      const searchText = cleanedText.replace(/quali|quando|dove|chi|elenca|mostra(?:mi)?|trova|appuntamenti|eventi|incontri|riunioni/gi, '').trim();
      
      if (searchText && searchText.length > 2) {
        schema.queryData.searchTerm = searchText;
      }
    }
    
    // Imposta il range temporale trovato
    if (Object.keys(timeRange).length > 0) {
      schema.queryData.timeRange = timeRange;
    }
    
    // Se non è specificato un range e non ci sono termini di ricerca,
    // per default cerca eventi futuri (da oggi)
    if (!schema.queryData.timeRange && !schema.queryData.searchTerm) {
      schema.queryData.timeRange = {
        start: new Date() // Da adesso in poi
      };
    }
  }
  
  /**
   * Calcola euristicamente un livello di confidenza per l'interpretazione
   * @private
   * @param {string} text - Il testo originale
   * @param {CommandSchema} schema - Lo schema popolato
   * @returns {number} - Livello di confidenza (0.0-1.0)
   */
  _calculateConfidence(text, schema) {
    // Punteggio base per intent riconosciuto
    let score = schema.intent ? 0.5 : 0.0;
    
    // Aggiungi punti per dati cruciali presenti
    if (['create', 'update', 'delete'].includes(schema.intent)) {
      // Dati evento
      if (schema.eventData.title) score += 0.2;
      if (schema.timeData.startDate) score += 0.1;
      if (schema.timeData.startTime) score += 0.1;
      if (schema.eventData.location) score += 0.05;
      if (schema.eventData.participants.length > 0) score += 0.05;
    } else if (['read', 'query'].includes(schema.intent)) {
      // Dati query
      if (schema.queryData.timeRange) score += 0.2;
      if (schema.queryData.searchTerm) score += 0.2;
    }
    
    // Riduci il punteggio per testi molto lunghi o complessi
    if (text.length > 100) score -= 0.1;
    if (text.split(' ').length > 15) score -= 0.05;
    
    // Controlla se ci sono ambiguità (potrebbe abbassare il punteggio)
    if (schema.parsingMetadata.ambiguities.length > 0) {
      score -= 0.1 * schema.parsingMetadata.ambiguities.length;
    }
    
    // Limita il punteggio tra 0.0 e 1.0
    return Math.max(0.0, Math.min(1.0, score));
  }
  
  /**
   * Rimuove pattern noti dal testo
   * @private
   * @param {string} text - Il testo da pulire
   * @param {Array<RegExp>} patterns - Lista di pattern regex da rimuovere
   * @returns {string} - Testo pulito
   */
  _removePatterns(text, patterns) {
    let cleanedText = text;
    for (const pattern of patterns) {
      cleanedText = cleanedText.replace(pattern, '');
    }
    return cleanedText.trim();
  }
  
  /**
   * Estrae un titolo significativo dal testo
   * @private
   * @param {string} text - Il testo da cui estrarre il titolo
   * @returns {string|null} - Titolo estratto o null se non trovato
   */
  _extractMeaningfulTitle(text) {
    // Rimuovi connettori e preposizioni comuni
    const cleanedText = text.replace(/^(un|una|il|la|lo|gli|le|di|a|da|in|con|su|per|tra|fra)\s+/i, '').trim();
    
    if (!cleanedText) return null;
    
    // Se il testo è breve, usalo direttamente
    if (cleanedText.length < 50) return cleanedText;
    
    // Altrimenti prova a estrarre i primi sostantivi/verbi significativi
    const words = cleanedText.split(/\s+/);
    if (words.length <= 5) return cleanedText;
    
    // Prendi le prime 5 parole come titolo
    return words.slice(0, 5).join(' ') + '...';
  }
  
  /**
   * Converte stringhe di data in oggetti Date
   * @private
   * @param {string} dateStr - Stringa con riferimento a data
   * @returns {Date} - Oggetto Date interpretato
   */
  _parseDateString(dateStr) {
    const today = new Date();
    
    // Gestisci casi speciali
    if (/oggi/i.test(dateStr)) {
      return new Date(today);
    } else if (/domani/i.test(dateStr)) {
      return addDays(today, 1);
    } else if (/dopodomani/i.test(dateStr)) {
      return addDays(today, 2);
    } else if (/ieri/i.test(dateStr)) {
      return addDays(today, -1);
    } else if (/l'altro ieri/i.test(dateStr)) {
      return addDays(today, -2);
    }
    
    // Gestisci giorni della settimana
    for (const [day, index] of Object.entries(this.DAYS_MAP)) {
      if (dateStr.toLowerCase().includes(day)) {
        return this._getNextDayOfWeek(today, index);
      }
    }
    
    // Gestisci "prossima/o" e "questa/o"
    if (/prossim[ao] settimana/i.test(dateStr)) {
      return addDays(today, 7);
    } else if (/prossim[ao] mese/i.test(dateStr)) {
      const nextMonth = new Date(today);
      nextMonth.setMonth(today.getMonth() + 1);
      return nextMonth;
    } else if (/quest[ao] settimana/i.test(dateStr)) {
      return today;
    } else if (/quest[ao] mese/i.test(dateStr)) {
      return today;
    }
    
    // Gestisci "scorsa/o"
    if (/scors[ao] settimana/i.test(dateStr)) {
      return addDays(today, -7);
    } else if (/scors[ao] mese/i.test(dateStr)) {
      const lastMonth = new Date(today);
      lastMonth.setMonth(today.getMonth() - 1);
      return lastMonth;
    }
    
    // Prova formati di data standard
    let date;
    
    // Estrai numeri da "il 15" o simili
    const dayMatch = dateStr.match(/il (\d{1,2})/i);
    if (dayMatch) {
      const day = parseInt(dayMatch[1], 10);
      date = new Date(today);
      date.setDate(day);
      
      // Se la data è nel passato, passa al mese successivo
      if (date < today) {
        date.setMonth(date.getMonth() + 1);
      }
      
      return date;
    }
    
    // Prova formato dd/mm/yyyy
    date = parse(dateStr, 'dd/MM/yyyy', new Date(), { locale: it });
    if (isValid(date)) return date;
    
    // Prova formato dd/mm
    date = parse(dateStr, 'dd/MM', new Date(), { locale: it });
    if (isValid(date)) {
      // Se la data è nel passato, imposta all'anno successivo
      if (date < today) {
        date.setFullYear(today.getFullYear() + 1);
      } else {
        date.setFullYear(today.getFullYear());
      }
      return date;
    }
    
    // In caso di fallimento, restituisci oggi
    return today;
  }
  
  /**
   * Converte stringhe di orario in oggetti Date
   * @private
   * @param {string} timeStr - Stringa con riferimento a orario
   * @returns {Date} - Oggetto Date con l'orario impostato
   */
  _parseTimeString(timeStr) {
    // Rimuovi parole chiave e spazi
    const cleanTime = timeStr.replace(/alle|ore|alle ore/i, '').trim();
    
    // Prova formati diversi
    let time;
    
    // Prova formato HH:mm
    time = parse(cleanTime, 'HH:mm', new Date(), { locale: it });
    if (isValid(time)) return time;
    
    // Prova formato H
    time = parse(cleanTime, 'H', new Date(), { locale: it });
    if (isValid(time)) return time;
    
    // In caso di fallimento, restituisci mezzogiorno come default
    const defaultTime = new Date();
    defaultTime.setHours(12, 0, 0, 0);
    return defaultTime;
  }
  
  /**
   * Ottieni il prossimo giorno della settimana specificato
   * @private
   * @param {Date} date - Data di riferimento
   * @param {number} dayOfWeek - Giorno della settimana (0=domenica, 1=lunedì, ...)
   * @returns {Date} - Data del prossimo giorno della settimana specificato
   */
  _getNextDayOfWeek(date, dayOfWeek) {
    const resultDate = new Date(date.getTime());
    resultDate.setDate(date.getDate() + (7 + dayOfWeek - date.getDay()) % 7);
    
    // Se la data risultante è oggi, aggiungi 7 giorni per ottenere la prossima settimana
    if (resultDate.toDateString() === date.toDateString()) {
      resultDate.setDate(resultDate.getDate() + 7);
    }
    
    return resultDate;
  }
} // <-- Assicurati che la classe sia chiusa correttamente qui

// Crea e esporta l'istanza singleton
const regexParser = new RegexParser();
export default regexParser;