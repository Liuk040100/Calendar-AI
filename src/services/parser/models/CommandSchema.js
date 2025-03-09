/**
 * Schema standardizzato del comando interpretato
 * Questa struttura dati rappresenta il risultato dell'analisi di un comando utente,
 * indipendentemente dal metodo di parsing utilizzato (regex o LLM).
 */
export class CommandSchema {
    constructor({
      // Informazioni principali
      intent = null,        // 'create', 'read', 'update', 'delete', 'query'
      confidence = 1.0,     // Livello di confidenza nell'interpretazione (0.0-1.0)
      
      // Dati evento
      eventData = {
        title: null,         // Titolo/nome dell'evento
        description: null,   // Descrizione dettagliata
        location: null,      // Luogo dell'evento
        participants: [],    // Lista di partecipanti
      },
      
      // Dati temporali
      timeData = {
        startDate: null,     // Data di inizio (oggetto Date)
        startTime: null,     // Ora di inizio (oggetto Date)
        endDate: null,       // Data di fine (oggetto Date)
        endTime: null,       // Ora di fine (oggetto Date)
        duration: null,      // Durata in minuti
        recurrence: null,    // Pattern di ricorrenza (daily, weekly, monthly, ecc.)
      },
      
      // Metadati del parsing
      parsingMetadata = {
        method: 'regex',     // Metodo di parsing usato: 'regex' o 'llm'
        rawText: '',         // Testo originale del comando
        ambiguities: [],     // Possibili ambiguità identificate
        missingInfo: [],     // Informazioni mancanti necessarie
      },
      
      // Dati per query
      queryData = {
        timeRange: null,     // Range temporale per ricerca eventi
        searchTerm: null,    // Termine di ricerca
        filterType: null,    // Filtro per tipo di evento
        limit: 10,           // Numero massimo di risultati
      },
      
      // Flag di validità
      isValid = false
    }) {
      this.intent = intent;
      this.confidence = confidence;
      this.eventData = eventData;
      this.timeData = timeData;
      this.parsingMetadata = {
        ...parsingMetadata,
        rawText: parsingMetadata.rawText || ''
      };
      this.queryData = queryData;
      this.isValid = isValid;
    }
    
    /**
     * Verifica se lo schema contiene informazioni sufficienti per l'intento specificato
     * @returns {boolean} - true se il comando è valido per l'intento corrente
     */
    validate() {
      switch (this.intent) {
        case 'create':
          // Per creare un evento serve almeno titolo e data
          return !!(this.eventData.title && 
                  (this.timeData.startDate || this.timeData.startTime));
                  
        case 'read':
        case 'query':
          // Per leggere/interrogare bastano i criteri di ricerca
          return !!(this.queryData.timeRange || 
                  this.queryData.searchTerm || 
                  this.queryData.filterType);
                  
        case 'update':
          // Per aggiornare serve identificare l'evento e avere qualcosa da modificare
          return !!(this.eventData.title &&
                  (this.timeData.startDate || this.timeData.startTime || 
                   this.eventData.description || this.eventData.location));
                  
        case 'delete':
          // Per eliminare serve identificare chiaramente l'evento
          return !!(this.eventData.title && 
                  (this.timeData.startDate || this.timeData.startTime));
                  
        default:
          return false;
      }
    }
    
    /**
     * Converte lo schema in un formato adatto per l'API di Google Calendar
     * @returns {Object} - Oggetto evento formattato per Google Calendar
     */
    toGoogleCalendarEvent() {
      if (this.intent !== 'create' && this.intent !== 'update') {
        throw new Error('Solo gli intenti create e update possono essere convertiti in eventi');
      }
      
      // Calcola l'ora di inizio e fine
      const startDateTime = this._combineDateTime(this.timeData.startDate, this.timeData.startTime);
      let endDateTime;
      
      if (this.timeData.endDate && this.timeData.endTime) {
        endDateTime = this._combineDateTime(this.timeData.endDate, this.timeData.endTime);
      } else if (this.timeData.duration) {
        // Se è specificata solo la durata, calcola l'ora di fine
        endDateTime = new Date(startDateTime.getTime() + this.timeData.duration * 60 * 1000);
      } else {
        // Default: durata di 1 ora
        endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
      }
      
      // Costruisci l'oggetto evento
      return {
        summary: this.eventData.title,
        description: this.eventData.description || '',
        location: this.eventData.location || '',
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        // Aggiungi gestione attendees se ci sono partecipanti
        attendees: this.eventData.participants.map(email => ({ email })),
      };
    }
    
    /**
     * Combina data e ora in un singolo oggetto Date
     * @private
     * @param {Date} date - Oggetto data
     * @param {Date} time - Oggetto ora
     * @returns {Date} - Oggetto Date combinato
     */
    _combineDateTime(date, time) {
      const result = new Date();
      
      // Se abbiamo una data, usa quella
      if (date) {
        result.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      }
      
      // Se abbiamo un'ora, usa quella
      if (time) {
        result.setHours(time.getHours(), time.getMinutes(), 0, 0);
      } else {
        // Default: mezzogiorno
        result.setHours(12, 0, 0, 0);
      }
      
      return result;
    }
    
    /**
     * Converte lo schema in parametri di ricerca per l'API di Google Calendar
     * @returns {Object} - Parametri di ricerca per Google Calendar
     */
    toGoogleCalendarSearchParams() {
      if (this.intent !== 'read' && this.intent !== 'query') {
        throw new Error('Solo gli intenti read e query possono essere convertiti in parametri di ricerca');
      }
      
      const params = {
        'calendarId': 'primary',
        'singleEvents': true,
        'maxResults': this.queryData.limit || 10,
        'orderBy': 'startTime'
      };
      
      // Aggiungi timeMin e timeMax se è specificato un intervallo
      if (this.queryData.timeRange) {
        if (this.queryData.timeRange.start) {
          params.timeMin = this.queryData.timeRange.start.toISOString();
        } else {
          params.timeMin = new Date().toISOString();
        }
        
        if (this.queryData.timeRange.end) {
          params.timeMax = this.queryData.timeRange.end.toISOString();
        }
      }
      
      // Aggiungi parametro di ricerca testo
      if (this.queryData.searchTerm) {
        params.q = this.queryData.searchTerm;
      }
      
      return params;
    }
  }
  
  export default CommandSchema;