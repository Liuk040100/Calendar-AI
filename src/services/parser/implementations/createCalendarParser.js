/**
 * @file createCalendarParser.js
 * @description Modulo avanzato per l'analisi di comandi vocali in linguaggio naturale per app di calendario
 * Genera prompt ottimizzati per modelli LLM con particolare attenzione all'estrazione corretta dei titoli
 * degli eventi, gestendo correttamente strutture linguistiche complesse.
 * 
 * @author Claude 2025
 * @version 2.0.0
 */

/**
 * Definizione della configurazione predefinita
 * @typedef {Object} CalendarConfig
 * @property {boolean} includeEventTypeInTitle - Se includere parole come "appuntamento", "evento" nei titoli
 * @property {number} defaultDuration - Durata predefinita degli eventi in minuti
 * @property {number} defaultLimit - Numero predefinito di risultati per le query
 * @property {string[]} exampleCommands - Array di esempi formattati come stringa
 * @property {Object.<string, string>} temporalExpressions - Mappatura di espressioni temporali
 * @property {Object.<string, RegExp[]>} titlePatterns - Pattern regex per estrazione avanzata del titolo
 */

/**
 * Configurazione predefinita usata in caso di errore nel caricamento del file esterno
 * @type {CalendarConfig}
 */
const DEFAULT_CONFIG = {
    includeEventTypeInTitle: false,
    defaultDuration: 60,
    defaultLimit: 10,
    exampleCommands: [
      'Comando: "Crea un evento chiamato riunione di team per domani alle 10"\nOutput: {"intent": "create", "confidence": 0.95, "eventData": {"title": "riunione di team", "description": null, "location": null, "participants": []}, "timeData": {"startDate": "2025-03-10", "startTime": "10:00", "endDate": "2025-03-10", "endTime": "11:00", "duration": 60, "recurrence": null}}',
      'Comando: "Mostra gli appuntamenti di oggi"\nOutput: {"intent": "read", "confidence": 0.98, "eventData": {"title": null, "description": null, "location": null, "participants": []}, "timeData": {"startDate": null, "startTime": null, "endDate": null, "endTime": null, "duration": null, "recurrence": null}, "queryData": {"timeRange": {"start": "2025-03-09T00:00:00", "end": "2025-03-09T23:59:59"}, "searchTerm": null, "filterType": "appuntamenti", "limit": 10}}'
    ],
    temporalExpressions: {
      "oggi": "data corrente",
      "domani": "data corrente + 1 giorno",
      "dopodomani": "data corrente + 2 giorni"
    },
    // Nuova proprietà: pattern regex avanzati per l'estrazione del titolo
    titlePatterns: {
      // Pattern per rilevare strutture come "chiamato X", "intitolato Y", "denominato Z"
      namedEvent: [
        // Cattura "chiamato/intitolato/denominato X" in vari formati
        /(?:chiamat[oa]|intitolat[oa]|denominat[oa])\s+['"]?([^'"]+?)['"]?(?:\s+per|\s+il|\s+alle|\s+a\b|\s*$)/i,
        // Pattern più specifico per catturare "un evento chiamato X"
        /(?:un|una|un'|l'|lo|la|gli|le)?\s*(?:evento|appuntamento|meeting|riunione|incontro|promemoria)?\s*(?:chiamat[oa]|intitolat[oa]|denominat[oa])\s+['"]?([^'"]+?)['"]?(?:\s+per|\s+il|\s+alle|\s+a\b|\s*$)/i
      ],
      // Pattern per rilevare "Ricordami di X"
      reminder: [
        /ricordami\s+di\s+(.+?)(?:\s+per|\s+il|\s+alle|\s+a\b|\s*$)/i
      ],
      // Pattern generici per il resto dei comandi
      generic: [
        // Rileva titoli dopo verbi di creazione
        /(?:crea|aggiungi|pianifica|organizza|metti)\s+(?:un|uno|una|un'|l'|lo|la)?\s*(.+?)(?:\s+per|\s+il|\s+alle|\s+a\b|\s*$)/i
      ]
    }
  };
  
  /**
   * Logger personalizzato con livelli di log e metadati
   * @param {string} level - Livello di log ('info', 'warn', 'error', 'debug')
   * @param {string} message - Messaggio da loggare
   * @param {Object} [metadata] - Metadati aggiuntivi opzionali
   */
  function logger(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...metadata
    };
    
    switch(level) {
      case 'error':
        console.error(JSON.stringify(logData));
        break;
      case 'warn':
        console.warn(JSON.stringify(logData));
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(JSON.stringify(logData));
        }
        break;
      case 'info':
      default:
        console.log(JSON.stringify(logData));
    }
  }
  
  /**
   * Carica configurazione da file, con gestione avanzata degli errori
   * @async
   * @param {string} configPath - Percorso del file di configurazione
   * @returns {Promise<CalendarConfig>} Configurazione caricata o predefinita in caso di errore
   */
  async function loadConfiguration(configPath) {
    try {
      // Per ambienti Node.js (senza fetch)
      if (typeof window === 'undefined') {
        try {
          // Caricamento dinamico di fs per supportare ambienti browser
          const fs = await import('fs/promises');
          const data = await fs.readFile(configPath, 'utf8');
          const config = JSON.parse(data);
          
          logger('info', 'Configurazione caricata con successo da file system Node.js', {
            configPath,
            configKeys: Object.keys(config)
          });
          
          return validateAndEnhanceConfig(config);
        } catch (nodeError) {
          throw new Error(`Errore nel caricamento via Node.js: ${nodeError.message}`);
        }
      }
      
      // Per ambienti browser (con fetch)
      const response = await fetch(configPath);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const config = await response.json();
      
      logger('info', 'Configurazione caricata con successo via fetch', {
        configPath,
        configKeys: Object.keys(config)
      });
      
      return validateAndEnhanceConfig(config);
    } catch (error) {
      logger('error', `Errore nel caricamento della configurazione: ${error.message}`, {
        configPath,
        errorName: error.name,
        stack: error.stack
      });
      
      logger('warn', 'Usando configurazione predefinita', {
        defaultConfig: Object.keys(DEFAULT_CONFIG)
      });
      
      return DEFAULT_CONFIG;
    }
  }
  
  /**
   * Valida e arricchisce la configurazione con valori predefiniti per campi mancanti
   * @param {Object} config - Configurazione caricata da validare
   * @returns {CalendarConfig} Configurazione validata e completa
   */
  function validateAndEnhanceConfig(config) {
    // Crea una nuova configurazione con i valori predefiniti fusi con quelli caricati
    const validatedConfig = {
      ...DEFAULT_CONFIG,
      ...config
    };
    
    // Assicura che titlePatterns esista, anche se non fornito
    if (!validatedConfig.titlePatterns) {
      validatedConfig.titlePatterns = DEFAULT_CONFIG.titlePatterns;
    } else {
      // Fondi i pattern personalizzati con quelli predefiniti
      validatedConfig.titlePatterns = {
        ...DEFAULT_CONFIG.titlePatterns,
        ...validatedConfig.titlePatterns
      };
    }
    
    // Controlli di validità sui valori numerici
    if (typeof validatedConfig.defaultDuration !== 'number' || validatedConfig.defaultDuration <= 0) {
      logger('warn', 'defaultDuration non valido, impostato valore predefinito', {
        providedValue: validatedConfig.defaultDuration,
        defaultValue: DEFAULT_CONFIG.defaultDuration
      });
      validatedConfig.defaultDuration = DEFAULT_CONFIG.defaultDuration;
    }
    
    if (typeof validatedConfig.defaultLimit !== 'number' || validatedConfig.defaultLimit <= 0) {
      logger('warn', 'defaultLimit non valido, impostato valore predefinito', {
        providedValue: validatedConfig.defaultLimit,
        defaultValue: DEFAULT_CONFIG.defaultLimit
      });
      validatedConfig.defaultLimit = DEFAULT_CONFIG.defaultLimit;
    }
    
    return validatedConfig;
  }
  
  /**
   * Crea un parser di comandi di calendario configurabile
   * @async
   * @param {string} [configFilePath='./calendar_config.json'] - Percorso del file di configurazione
   * @returns {Promise<Function>} Funzione parser configurata
   */
  export async function createCalendarParser(configFilePath = './calendar_config.json') {
    // Carica la configurazione in modo asincrono
    const config = await loadConfiguration(configFilePath);
    
    /**
     * Estrattore avanzato del titolo dell'evento, elemento critico del parser
     * Utilizza pattern regex specifici per gestire casi problematici
     * @param {string} text - Testo del comando
     * @returns {string|null} Titolo estratto o null se non trovato
     */
    function extractEventTitle(text) {
      let title = null;
      let matchResult = null;
      
      // Prova prima i pattern per "chiamato X", "intitolato Y", ecc.
      for (const pattern of config.titlePatterns.namedEvent) {
        matchResult = text.match(pattern);
        if (matchResult && matchResult[1]) {
          title = matchResult[1].trim();
          logger('debug', 'Titolo estratto usando pattern namedEvent', { 
            pattern: pattern.toString(),
            match: matchResult[0],
            title 
          });
          break;
        }
      }
      
      // Se non trova, prova i pattern per "Ricordami di X"
      if (!title) {
        for (const pattern of config.titlePatterns.reminder) {
          matchResult = text.match(pattern);
          if (matchResult && matchResult[1]) {
            // Per i promemoria, manteniamo "ricordami di" solo se configurato
            title = config.includeEventTypeInTitle 
              ? `ricordami di ${matchResult[1].trim()}`
              : matchResult[1].trim();
            
            logger('debug', 'Titolo estratto usando pattern reminder', { 
              pattern: pattern.toString(), 
              match: matchResult[0],
              title 
            });
            break;
          }
        }
      }
      
      // Infine, prova i pattern generici
      if (!title) {
        for (const pattern of config.titlePatterns.generic) {
          matchResult = text.match(pattern);
          if (matchResult && matchResult[1]) {
            title = matchResult[1].trim();
            
            // Rimuovi parole generiche se configurato
            if (!config.includeEventTypeInTitle) {
              const genericWords = ['appuntamento', 'evento', 'riunione', 'incontro', 'meeting', 'promemoria'];
              for (const word of genericWords) {
                // Rimuovi la parola generica solo se è all'inizio del titolo
                const wordPattern = new RegExp(`^${word}\\s+`, 'i');
                title = title.replace(wordPattern, '');
              }
            }
            
            logger('debug', 'Titolo estratto usando pattern generic', { 
              pattern: pattern.toString(), 
              match: matchResult[0],
              title 
            });
            break;
          }
        }
      }
      
      // Pulizia finale del titolo
      if (title) {
        // Rimuovi eventuali caratteri di punteggiatura in eccesso
        title = title.replace(/^['"\\(\\[{]|['"\\)\\]}]$/g, '');
        
        // Rimuovi eventuali prefissi o suffissi indesiderati
        const unwantedPrefixes = ['un ', 'uno ', 'una ', "un'", "l'", 'lo ', 'la ', 'gli ', 'le '];
        for (const prefix of unwantedPrefixes) {
          if (title.toLowerCase().startsWith(prefix)) {
            title = title.substring(prefix.length);
          }
        }
      }
      
      return title;
    }
    
    /**
     * Genera istruzioni per l'estrazione del titolo
     * @returns {string} Istruzioni formattate
     */
    function generateTitleInstructions() {
      // Istruzioni base per l'estrazione del titolo
      const baseInstructions = `ISTRUZIONI CRITICHE PER L'ESTRAZIONE DEL TITOLO:`;
      
      // Istruzioni specifiche per gestire strutture problematiche
      const specialPatternInstructions = `
  - GESTIONE STRUTTURE SPECIALI (PRIORITÀ MASSIMA):
    * Quando il comando contiene frasi come "chiamato X", "intitolato Y", "denominato Z", devi estrarre SOLO X, Y o Z come titolo.
    * Esempio: "Crea un evento chiamato riunione di team per domani" → titolo: "riunione di team"
    * Esempio: "Aggiungi un appuntamento intitolato visita medica alle 15" → titolo: "visita medica"
    * Esempio: "Pianifica un incontro denominato colloquio annuale il 5 aprile" → titolo: "colloquio annuale"
    * NON includere MAI nel titolo le parole "chiamato", "intitolato", "denominato" o simili.
    * NON includere MAI nel titolo articoli o frasi che precedono queste parole (come "un evento chiamato").
    * NON includere MAI nel titolo informazioni temporali o di contesto che seguono il titolo.`;
      
      // Istruzioni specifiche basate sulla configurazione
      const configSpecificInstructions = config.includeEventTypeInTitle
        ? `
  - GESTIONE PAROLE GENERICHE:
    * MANTIENI nel titolo le parole come "appuntamento", "evento", "riunione" quando fanno parte del comando.
    * Esempio: "Aggiungi appuntamento dal dentista" → titolo: "appuntamento dal dentista"
    * Esempio: "Crea riunione di lavoro" → titolo: "riunione di lavoro"
    * Esempio: "Pianifica incontro con fornitori" → titolo: "incontro con fornitori"
    * Per comandi "Ricordami di X", il titolo deve includere l'azione: "ricordami di comprare il latte"`
        : `
  - GESTIONE PAROLE GENERICHE:
    * RIMUOVI dal titolo le parole generiche come "appuntamento", "evento", "riunione", "incontro".
    * Esempio: "Aggiungi appuntamento dal dentista" → titolo: "dal dentista"
    * Esempio: "Crea riunione di lavoro" → titolo: "lavoro"
    * Esempio: "Pianifica incontro con fornitori" → titolo: "con fornitori"
    * Per comandi "Ricordami di X", il titolo deve essere solo: "comprare il latte"`;
      
      // Combina tutte le istruzioni
      return `${baseInstructions}${specialPatternInstructions}${configSpecificInstructions}`;
    }
    
    /**
     * Genera istruzioni per distinguere tra "read" e "query"
     * @returns {string} Istruzioni formattate
     */
    function generateReadQueryInstructions() {
      return `DISTINZIONE TRA "read" E "query":
  - "read": visualizzazione diretta di eventi specifici o in un periodo definito.
    * Esempi: "Mostra appuntamento col dentista", "Visualizza eventi di domani"
    * Caratteristiche: riferimento a eventi noti, timeRange specifico, verbi come "mostra", "visualizza"
    
  - "query": ricerche, domande o richieste che richiedono filtraggio.
    * Esempi: "Quali appuntamenti ho questa settimana?", "Cerca eventi con Mario", "Ci sono riunioni domani?"
    * Caratteristiche: domande, termini di ricerca, uso di filtri, verbi come "cerca", "trova"`;
    }
    
    /**
     * Genera istruzioni per la gestione dei riferimenti temporali
     * @returns {string} Istruzioni formattate
     */
    function generateTemporalInstructions() {
      // Crea una rappresentazione delle espressioni temporali configurate
      let temporalMappings = '';
      
      if (config.temporalExpressions && Object.keys(config.temporalExpressions).length > 0) {
        temporalMappings = Object.entries(config.temporalExpressions)
          .map(([expression, mapping]) => `    * "${expression}" → ${mapping}`)
          .join('\n');
      } else {
        temporalMappings = `    * "oggi" → data odierna (00:00-23:59)
      * "domani" → data di domani (00:00-23:59)
      * "dopodomani" → data di dopodomani (00:00-23:59)
      * "ieri" → data di ieri (00:00-23:59)
      * "questa settimana" → da oggi a 7 giorni dopo
      * "prossima settimana" → da lunedì prossimo a domenica prossima
      * "questo mese" → da oggi a fine mese corrente
      * "prossimo mese" → tutto il mese successivo`;
      }
      
      return `GESTIONE DEI RIFERIMENTI TEMPORALI:
  - Riferimenti assoluti: converti date esplicite in formato ISO 8601.
    * "15 marzo 2025" → "2025-03-15"
    * "15/03/2025" → "2025-03-15"
    
  - Riferimenti relativi: mappatura (rispetto alla data odierna):
  ${temporalMappings}
    
  - Orari: converti sempre in formato 24 ore.
    * "3 del pomeriggio" → "15:00"
    * "9 di sera" → "21:00"
    * "alle 8 di mattina" → "08:00"
    * "mezzogiorno" → "12:00"
    * "mezzanotte" → "00:00"`;
    }
    
    /**
     * Genera la sezione di esempi dal file di configurazione
     * @returns {string} Esempi formattati o stringa vuota se non disponibili
     */
    function generateExamples() {
      if (!config.exampleCommands || config.exampleCommands.length === 0) {
        return '';
      }
      
      return `ESEMPI DI COMANDI CORRETTI:\n\n${config.exampleCommands.join('\n\n')}`;
    }
    
    /**
     * Genera introduzione del prompt con descrizione del compito
     * @param {string} todayStr - Data odierna in formato ISO
     * @returns {string} Introduzione formattata
     */
    function generateIntroduction(todayStr) {
      return `Sei un parser specializzato per un'applicazione di calendario avanzata chiamata Calendar AI.
  Analizza il seguente comando in italiano e convertilo in un formato JSON strutturato.
  
  OGGI È: ${todayStr}
  
  I comandi possono essere di tipo:
  - create: creazione di un nuovo evento (es. "Crea", "Aggiungi", "Ricordami", "Pianifica")
  - read: visualizzazione di eventi esistenti (es. "Mostra", "Visualizza", "Fammi vedere")
  - update: modifica di un evento esistente (es. "Modifica", "Aggiorna", "Sposta", "Cambia")
  - delete: eliminazione di un evento (es. "Elimina", "Cancella", "Rimuovi")
  - query: interrogazione sul calendario (es. "Cerca", "Trova", domande come "Quali sono...", "Ci sono...")`;
    }
    
    /**
     * Genera istruzioni per il formato di output JSON
     * @returns {string} Istruzioni sul formato di output
     */
    function generateOutputFormat() {
      return `Rispondi ESCLUSIVAMENTE con un JSON valido che include:
  {
    "intent": "l'intento del comando (create, read, update, delete, query)",
    "confidence": "livello di confidenza nell'interpretazione (0.0-1.0)",
    "eventData": {
      "title": "titolo dell'evento (estratto secondo le regole specificate)",
      "description": "descrizione dettagliata o null",
      "location": "luogo dell'evento o null",
      "participants": ["lista", "di", "partecipanti"] o array vuoto
    },
    "timeData": {
      "startDate": "data di inizio in formato ISO o null",
      "startTime": "ora di inizio in formato ISO o null",
      "endDate": "data di fine in formato ISO o null",
      "endTime": "ora di fine in formato ISO o null",
      "duration": "durata in minuti o null (default: ${config.defaultDuration})",
      "recurrence": "pattern di ricorrenza o null"
    },
    "queryData": {
      "timeRange": {
        "start": "inizio range temporale in formato ISO o null",
        "end": "fine range temporale in formato ISO o null"
      },
      "searchTerm": "termine di ricerca o null",
      "filterType": "filtro per tipo di evento o null",
      "limit": "numero massimo di risultati (default ${config.defaultLimit})"
    },
    "ambiguities": ["possibili ambiguità nel comando"],
    "missingInfo": ["informazioni mancanti necessarie"]
  }
  
  Non includere ASSOLUTAMENTE nessun altro testo oltre al JSON valido.`;
    }
    
    /**
     * Funzione parser principale che analizza comandi di calendario
     * @param {string} text - Testo del comando da analizzare
     * @param {string} [todayStr=null] - Data odierna in formato ISO (YYYY-MM-DD), se null usa data corrente
     * @returns {string} Prompt completo formattato per l'LLM
     */
    return function parseCalendarCommand(text, todayStr = null) {
      // Se non è fornita una data, usa quella corrente
      if (!todayStr) {
        const today = new Date();
        todayStr = today.toISOString().split('T')[0]; // Formato YYYY-MM-DD
      }
      
      // Estrai un eventuale titolo per debug (non usato nel prompt finale)
      const debugTitle = extractEventTitle(text);
      logger('debug', 'Analisi preliminare del titolo', { 
        command: text,
        extractedTitle: debugTitle 
      });
      
      // Componi le sezioni del prompt
      const introSection = generateIntroduction(todayStr);
      const readQuerySection = generateReadQueryInstructions();
      const titleSection = generateTitleInstructions();
      const temporalSection = generateTemporalInstructions();
      const examplesSection = generateExamples();
      const outputSection = generateOutputFormat();
      
      // Costruisci il prompt completo in modo modulare
      const fullPrompt = [
        introSection,
        `Comando: "${text}"`,
        titleSection, // Le istruzioni per l'estrazione del titolo hanno alta priorità
        readQuerySection,
        temporalSection,
        examplesSection,
        outputSection
      ].filter(Boolean).join('\n\n');
      
      logger('info', 'Prompt generato', { 
        commandLength: text.length,
        promptLength: fullPrompt.length,
        sections: {
          intro: Boolean(introSection),
          readQuery: Boolean(readQuerySection),
          title: Boolean(titleSection),
          temporal: Boolean(temporalSection),
          examples: Boolean(examplesSection),
          output: Boolean(outputSection)
        }
      });
      
      return fullPrompt;
    };
  }
  
  export default createCalendarParser;