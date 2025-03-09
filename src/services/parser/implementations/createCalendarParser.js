// Parser Calendar AI - Versione migliorata
// Questa funzione carica le istruzioni da un file esterno
async function createCalendarParser(configFilePath = './calendar_config.json') {
    // Carica la configurazione da un file JSON esterno
    let config;
    try {
      const response = await fetch(configFilePath);
      config = await response.json();
    } catch (error) {
      console.error(`Errore nel caricamento del file di configurazione: ${error}`);
      // Configurazione predefinita in caso di fallimento
      config = {
        includeEventTypeInTitle: true, // Ora è configurabile!
        defaultDuration: 60,
        defaultLimit: 10,
        exampleCommands: []  // Gli esempi sono ora nel file di configurazione
      };
    }
  
    // Funzione principale del parser
    return function parseCalendarCommand(text, todayStr) {
      // La funzione può utilizzare i parametri di configurazione dal file esterno
      const includeEventTypeInTitle = config.includeEventTypeInTitle;
      
      return `Sei un parser specializzato per un'applicazione di calendario chiamata Calendar AI.
  Analizza il seguente comando in italiano e convertilo in un formato JSON strutturato.
  
  OGGI È: ${todayStr}
  
  Comando: "${text}"
  
  I comandi possono essere di tipo:
  - create: creazione di un nuovo evento (es. "Crea", "Aggiungi", "Ricordami", "Pianifica")
  - read: lettura/visualizzazione di eventi esistenti (es. "Mostra", "Visualizza", "Quali sono")
  - update: modifica di un evento esistente (es. "Modifica", "Aggiorna", "Sposta")
  - delete: eliminazione di un evento (es. "Elimina", "Cancella", "Rimuovi")
  - query: interrogazione sul calendario (es. "Cerca", "Trova", domande come "Quali sono gli appuntamenti...")
  
  IMPORTANTE PER I COMANDI DI TIPO "query" O "read":
  - Se l'utente chiede "quali sono gli appuntamenti...", deve essere interpretato come intent "query"
  - Il titolo deve essere impostato in base al contesto della richiesta
  - Devi impostare correttamente timeRange in base a eventuali riferimenti temporali
  
  IMPORTANTE PER I COMANDI DI TIPO "create":
  ${includeEventTypeInTitle ? 
    '- Gli eventi dovrebbero mantenere il nome originale menzionato dall\'utente, incluse parole come "appuntamento", "evento", "riunione" se rilevanti al contesto' : 
    '- Gli eventi hanno sempre un titolo che NON deve includere parole come "appuntamento", "evento", "riunione"'
  }
  ${!includeEventTypeInTitle ? 
    '- Per esempio, "Aggiungi appuntamento dal dentista" → il titolo deve essere "dal dentista", non "appuntamento dal dentista"' : 
    '- Per esempio, "Aggiungi appuntamento dal dentista" → il titolo sarà "appuntamento dal dentista"'
  }
  ${!includeEventTypeInTitle ? 
    '- Se il comando è "Ricordami di X", il titolo deve essere semplicemente "X" (es. "Ricordami di comprare il latte" → titolo: "comprare il latte")' : 
    '- Conserva sempre l\'intento e il contesto originale dell\'utente nel titolo'
  }
  
  ${config.exampleCommands.length > 0 ? 'ESEMPI DI COMANDI CORRETTI:\n\n' + config.exampleCommands.join('\n\n') : ''}
  
  Rispondi con un JSON valido che include:
  {
    "intent": "l'intento del comando (create, read, update, delete, query)",
    "confidence": "livello di confidenza nell'interpretazione (0.0-1.0)",
    "eventData": {
      "title": "titolo dell'evento",
      "description": "descrizione dettagliata",
      "location": "luogo dell'evento",
      "participants": ["lista", "di", "partecipanti"]
    },
    "timeData": {
      "startDate": "data di inizio in formato ISO o null",
      "startTime": "ora di inizio in formato ISO o null",
      "endDate": "data di fine in formato ISO o null",
      "endTime": "ora di fine in formato ISO o null",
      "duration": "durata in minuti o null",
      "recurrence": "pattern di ricorrenza o null"
    },
    "queryData": {
      "timeRange": {
        "start": "inizio range temporale in formato ISO o null",
        "end": "fine range temporale in formato ISO o null"
      },
      "searchTerm": "termine di ricerca o null",
      "filterType": "filtro per tipo di evento o null",
      "limit": "numero massimo di risultati (default ${config.defaultLimit || 10})"
    },
    "ambiguities": ["possibili ambiguità"],
    "missingInfo": ["informazioni mancanti"]
  }
  
  Non includere nessun altro testo oltre al JSON.`;
    };
  }
  
  // Esempio di utilizzo
  // const parser = await createCalendarParser('./mio_file_config.json');
  // const prompt = parser("Aggiungi appuntamento dal dentista domani alle 15", "2025-03-09");