import ParserInterface from '../interfaces/ParserInterface';
import CommandSchema from '../models/CommandSchema';
import { createCalendarParser } from './createCalendarParser';

/**
 * Implementazione del parser basata su Gemini (Google AI)
 */
export class LLMParser extends ParserInterface {
  constructor(config = {}) {
    super();
    
    this.config = {
      apiKey: config.apiKey || import.meta.env.VITE_GEMINI_API_KEY,
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      configPath: './calendar_config.json', // Percorso configurazione per prompt builder
      ...config
    };
    
    this.isConfigured = !!this.config.apiKey;
    this.promptBuilder = null;

    console.log('LLMParser inizializzato:', { 
      isConfigured: this.isConfigured, 
      apiKeyPresente: !!this.config.apiKey
    });

    // Inizializza il builder di prompt
    this._initPromptBuilder();
  }

  /**
   * Inizializza il builder di prompt
   * @private
   */
  async _initPromptBuilder() {
    try {
      this.promptBuilder = await createCalendarParser(this.config.configPath);
      console.log('Prompt builder inizializzato');
    } catch (error) {
      console.error('Errore durante l\'inizializzazione del prompt builder:', error);
      // Fallback a null, verrà ritentato quando necessario
      this.promptBuilder = null;
    }
  }
  
  /**
   * Analizza un comando in linguaggio naturale
   * @param {string} text - Il testo del comando da analizzare
   * @returns {Promise<CommandSchema>} - Schema del comando analizzato
   */
  async parseCommand(text) {
    console.log('LLMParser.parseCommand chiamato con:', text);
    
    if (!this.isConfigured) {
      console.warn('LLMParser non configurato: API key mancante');
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
      // Se il promptBuilder non è stato inizializzato, riprova
      if (!this.promptBuilder) {
        await this._initPromptBuilder();
        
        // Se ancora non è disponibile, segnala errore
        if (!this.promptBuilder) {
          throw new Error('Impossibile inizializzare il prompt builder');
        }
      }

      // Genera il prompt usando il builder
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const prompt = this.promptBuilder(text, todayStr);
      
      console.log('Prompt per Gemini:', prompt);
      
      const response = await fetch(`${this.config.endpoint}?key=${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1, // Ridotta per maggiore determinismo
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 1024
          }
        })
      });
      
      console.log('Risposta API status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Errore API Gemini:', errorData);
        throw new Error(`Errore API Gemini: ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      
      // Estrai la risposta strutturata
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('Risposta API vuota o non valida');
      }
      
      const content = data.candidates[0]?.content?.parts[0]?.text;
      if (!content) {
        throw new Error('Contenuto della risposta non trovato');
      }
      
      console.log('Risposta testuale da Gemini:', content);
      const structuredResponse = this._parseResponse(content);
      console.log('Risposta strutturata:', structuredResponse);
      
      // Correggi eventuali problemi comuni nelle risposte
      this._fixCommonIssues(structuredResponse, text);
      
      // Converti in CommandSchema
      const commandSchema = this._toCommandSchema(structuredResponse, text);
      console.log('Schema finale del comando:', commandSchema);
      
      return commandSchema;
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
   * Corregge problemi comuni nelle risposte di Gemini
   * @private
   * @param {Object} response - La risposta strutturata
   * @param {string} originalText - Il testo originale del comando
   */
  _fixCommonIssues(response, originalText) {
    const lowerText = originalText.toLowerCase();
    
    // ===== CORREZIONE TITOLI =====
    if (response.intent === 'create' && response.eventData && response.eventData.title) {
      let newTitle = response.eventData.title;
      let titoloCorretto = false;
      
      // 1. Pattern "chiamato/intitolato/denominato X"
      const titlePatterns = [
        /(?:un |una |l[''])?(?:evento|appuntamento|riunione|incontro)(?:\s+(?:chiamato|intitolato|denominato|dal nome|di nome))\s+["']?([^"'\n]+?)["']?(?:\s+(?:per|il|alle|domani|oggi|alle|dalle|da|con|al|a)\s+|$)/i,
        /(?:chiamato|intitolato|denominato|dal nome|di nome)\s+["']?([^"'\n]+?)["']?(?:\s+(?:per|il|alle|domani|oggi|alle|dalle|da|con|al|a)\s+|$)/i
      ];
      
      for (const pattern of titlePatterns) {
        const match = originalText.match(pattern);
        if (match && match[1]) {
          newTitle = match[1].trim();
          titoloCorretto = true;
          break;
        }
      }
      
      // 2. Caso "ricordami di X"
      if (!titoloCorretto && lowerText.includes('ricordami')) {
        const ricordamiMatch = originalText.match(/ricordami\s+(?:di\s+)?(.+?)(?:\s+(?:per|il|alle|domani|oggi)\s+|$)/i);
        if (ricordamiMatch && ricordamiMatch[1]) {
          newTitle = ricordamiMatch[1].trim();
          titoloCorretto = true;
        }
      }
      
      // 3. Filtraggio generico - rimuove parole problematiche
      if (!titoloCorretto) {
        // Rimuovi parole problematiche che potrebbero essere state incluse erroneamente
        const wordsToRemove = [
          'un evento', 'una evento', 'l\'evento', 'evento',
          'un appuntamento', 'una appuntamento', 'l\'appuntamento', 'appuntamento',
          'una riunione', 'un riunione', 'la riunione', 'riunione',
          'chiamato', 'intitolato', 'denominato', 'dal nome', 'di nome'
        ];
        
        let tempTitle = newTitle;
        for (const word of wordsToRemove) {
          if (tempTitle.toLowerCase().startsWith(word.toLowerCase() + ' ')) {
            tempTitle = tempTitle.substring(word.length).trim();
          }
        }
        
        // Solo se la pulizia ha fatto qualcosa di sensato
        if (tempTitle && tempTitle.length > 2 && tempTitle !== newTitle) {
          newTitle = tempTitle;
          titoloCorretto = true;
        }
      }
      
      // 4. Pulizia finale
      // Rimuovi virgolette e spazi in eccesso
      newTitle = newTitle.replace(/^["']+|["']+$/g, '').trim();
      
      // Rimuovi parole temporali alla fine ("per domani", "alle 15", ecc.)
      newTitle = newTitle.replace(/\s+(?:per|al|alle|dalle|da)\s+(?:\d{1,2}|\d{1,2}[:.]\d{2}|domani|oggi|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica).*$/i, '');
      
      // Log e aggiornamento solo se c'è stata una modifica
      if (newTitle !== response.eventData.title) {
        console.log(`Correzione titolo: da "${response.eventData.title}" a "${newTitle}"`);
        response.eventData.title = newTitle;
      }
    }
    
    // ===== CORREZIONE DATE E ORARI =====
    if (response.timeData) {
      ['startTime', 'endTime'].forEach(timeField => {
        if (response.timeData[timeField] && typeof response.timeData[timeField] === 'string') {
          // Verifica se l'ora è corretta rispetto al comando originale
          const timeMatch = lowerText.match(/(\d{1,2})(?::(\d{2}))?\s*(?:del (pomeriggio|mattino|sera))?/);
          if (timeMatch) {
            let hour = parseInt(timeMatch[1], 10);
            const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            
            // Aggiusta per formato 12h se specificato
            if (timeMatch[3] === 'pomeriggio' && hour < 12) {
              hour += 12;
            } else if (timeMatch[3] === 'sera' && hour < 12) {
              hour += 12;
            }
            
            // Verifica se l'ora nella risposta è diversa e correggila
            const dateObj = new Date(response.timeData[timeField]);
            const currentHour = dateObj.getHours();
            
            if (currentHour !== hour) {
              console.log(`Correzione ora per ${timeField}: da ${currentHour} a ${hour}`);
              dateObj.setHours(hour, minutes);
              response.timeData[timeField] = dateObj.toISOString();
            }
          }
        }
      });
    }
    
    // ===== CORREZIONE INTENT =====
    // Correzione di intent "read"/"query" per domande sugli appuntamenti
    if ((lowerText.includes('quali') || lowerText.includes('mostra') || 
         lowerText.includes('visualizza') || lowerText.includes('vedi') ||
         lowerText.includes('trova') || lowerText.includes('cerca') ||
         lowerText.includes('dammi') || lowerText.includes('elenca')) &&
        (lowerText.includes('appuntament') || lowerText.includes('event') || 
         lowerText.includes('riunion') || lowerText.includes('calendar'))) {
      
      console.log('Correzione: intent cambiato a "query" in base al testo');
      response.intent = 'query';
      
      // Se il parser ha interpretato il testo come titolo, spostalo in searchTerm
      if (response.eventData && response.eventData.title) {
        if (!response.queryData) {
          response.queryData = {};
        }
        
        if (!response.queryData.searchTerm && response.eventData.title.length > 3) {
          response.queryData.searchTerm = response.eventData.title;
        }
        
        response.eventData.title = '';
      }
      
      // Configura timeRange se si riferisce a un periodo specifico
      if (!response.queryData) {
        response.queryData = {};
      }
      
      if (!response.queryData.timeRange) {
        response.queryData.timeRange = {};
      }
      
      // Per riferimenti a "domani", "oggi", ecc.
      if (lowerText.includes('domani')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const tomorrowEnd = new Date(tomorrow);
        tomorrowEnd.setHours(23, 59, 59, 999);
        
        response.queryData.timeRange.start = tomorrow.toISOString();
        response.queryData.timeRange.end = tomorrowEnd.toISOString();
      } else if (lowerText.includes('oggi')) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        
        response.queryData.timeRange.start = today.toISOString();
        response.queryData.timeRange.end = todayEnd.toISOString();
      } else if (lowerText.includes('settimana')) {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        
        response.queryData.timeRange.start = today.toISOString();
        response.queryData.timeRange.end = nextWeek.toISOString();
      }
    }
    
    // Correzione per comandi di eliminazione che riguardano periodi
    if (response.intent === 'delete' &&
        (lowerText.includes('tutti') || lowerText.includes('gli appuntamenti')) &&
        (lowerText.includes('domani') || lowerText.includes('oggi') || 
         lowerText.includes('settimana') || lowerText.includes('mese'))) {
      
      console.log('Rilevato comando complesso di eliminazione con riferimento a periodo');
      response.intent = 'query';  // Prima query, poi l'interfaccia mostrerà opzioni per eliminare
      
      // Configura il filtro temporale appropriato
      if (!response.queryData) {
        response.queryData = {};
      }
      
      if (!response.queryData.timeRange) {
        response.queryData.timeRange = {};
      }
      
      if (lowerText.includes('domani')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const tomorrowEnd = new Date(tomorrow);
        tomorrowEnd.setHours(23, 59, 59, 999);
        
        response.queryData.timeRange.start = tomorrow.toISOString();
        response.queryData.timeRange.end = tomorrowEnd.toISOString();
      } else if (lowerText.includes('oggi')) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        
        response.queryData.timeRange.start = today.toISOString();
        response.queryData.timeRange.end = todayEnd.toISOString();
      }
    }
  }
  
  /**
   * Verifica se il parser può gestire un determinato tipo di comando
   * @param {string} text - Il testo del comando
   * @returns {Promise<boolean>} - true se può gestirlo
   */
  async canHandle(text) {
    return this.isConfigured;
  }
  
  /**
   * Calcola il livello di confidenza per il parsing del comando
   * @param {string} text - Il testo del comando
   * @returns {Promise<number>} - Valore tra 0 e 1
   */
  async getConfidence(text) {
    return this.isConfigured ? 0.9 : 0;
  }
  
  /**
   * Estrae e analizza il JSON dalla risposta dell'API
   * @private
   * @param {string} response - Risposta testuale dell'API
   * @returns {Object} - Oggetto JSON analizzato
   */
  _parseResponse(response) {
    try {
      // Trova la parte che contiene JSON nella risposta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonText = jsonMatch[0];
        try {
          return JSON.parse(jsonText);
        } catch (jsonError) {
          console.error('Errore nel parsing JSON:', jsonError);
          console.log('JSON non valido:', jsonText);
          
          // Tenta di correggere errori comuni nel JSON
          let fixedJson = jsonText
            .replace(/,\s*}/g, '}')  // Rimuove virgole finali
            .replace(/,\s*\]/g, ']') // Rimuove virgole finali negli array
            .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":'); // Assicura che le chiavi abbiano virgolette
            
          try {
            return JSON.parse(fixedJson);
          } catch (fixError) {
            throw new Error(`JSON non valido e non correggibile: ${fixError.message}`);
          }
        }
      }
      
      throw new Error('Formato di risposta non valido: JSON non trovato');
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
   * @param {Object} structuredResponse - Risposta strutturata dall'API
   * @param {string} originalText - Testo originale del comando
   * @returns {CommandSchema} - Schema del comando
   */
  _toCommandSchema(structuredResponse, originalText) {
    const { 
      intent, 
      confidence = 0, 
      eventData = {}, 
      timeData = {}, 
      queryData = {},
      ambiguities = [], 
      missingInfo = [] 
    } = structuredResponse;
    
    // Correzioni speciali per i comandi "ricordami"
    if (originalText.toLowerCase().includes('ricordami') && !intent) {
      structuredResponse.intent = 'create';
      
      // Estrai "ricordami di XXX" come titolo se non già impostato
      if (!eventData.title || eventData.title.trim() === '') {
        const match = originalText.match(/ricordami\s+(?:di\s+)?(.+?)(?:\s+il|\s+domani|\s+alle|\s+oggi|$)/i);
        if (match && match[1]) {
          eventData.title = match[1].trim();
        }
      }
    }
    
    // Converti stringhe di data in oggetti Date
    const convertDates = (data) => {
      const result = { ...data };
      
      // Campi di data diretti
      ['startDate', 'endDate', 'startTime', 'endTime'].forEach(field => {
        if (result[field] && typeof result[field] === 'string' && result[field] !== 'null') {
          try {
            result[field] = new Date(result[field]);
          } catch (e) {
            console.warn(`Impossibile convertire ${field}: ${result[field]}`);
            result[field] = null;
          }
        } else if (result[field] === 'null' || result[field] === '') {
          result[field] = null;
        }
      });
      
      // Se la data di inizio non è specificata per un evento create, imposta oggi
      if (structuredResponse.intent === 'create' && !result.startDate) {
        result.startDate = new Date();
      }
      
      // Campi annidati in timeRange
      if (result.timeRange) {
        ['start', 'end'].forEach(field => {
          if (result.timeRange[field] && typeof result.timeRange[field] === 'string' && result.timeRange[field] !== 'null') {
            try {
              result.timeRange[field] = new Date(result.timeRange[field]);
            } catch (e) {
              console.warn(`Impossibile convertire timeRange.${field}: ${result.timeRange[field]}`);
              result.timeRange[field] = null;
            }
          } else if (result.timeRange[field] === 'null' || result.timeRange[field] === '') {
            result.timeRange[field] = null;
          }
        });
      }
      
      return result;
    };
    
    const processedTimeData = convertDates(timeData);
    
    let processedQueryData = queryData;
    
    // Se queryData contiene timeRange, processiamo anche quello
    if (queryData && queryData.timeRange) {
      processedQueryData = convertDates(queryData);
    }
    
    // Crea lo schema
    const schema = new CommandSchema({
      intent: structuredResponse.intent || intent,
      confidence: parseFloat(confidence) || 0.7, // Default 0.7 se non specificato
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
    
    // Imposta validità in base al metodo validate()
    schema.isValid = schema.validate();
    
    return schema;
  }
}

// Esporta un'istanza singleton come default export
const llmParser = new LLMParser();
export default llmParser;