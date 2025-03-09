/**
 * Configurazione del sistema di parsing
 * Questo file contiene tutte le impostazioni del sistema di parsing,
 * incluse le configurazioni per l'integrazione con LLM.
 */
export const parserConfig = {
    // Impostazioni generali
    useRegexOnly: true,           // Se true, usa solo il parser regex
    useRegexFallback: true,       // Se true, usa regex come fallback quando LLM non è sicuro
    confidenceThreshold: 0.6,     // Soglia di confidenza per accettare l'interpretazione
    
    // Configurazione LLM (da modificare quando si integrerà un LLM)
    llm: {
      apiKey: null,               // API key per l'LLM (NON mettere qui la chiave, caricala da env)
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo',     // Modello da utilizzare
      maxTokens: 150,             // Numero massimo di token nella risposta
      temperature: 0.2,           // Temperatura per la generazione (più bassa = più deterministica)
      
      // Prompt di sistema
      systemPrompt: `Sei un assistente specializzato nell'analisi di comandi in italiano per un'app di calendario.
      Il tuo compito è interpretare i comandi dell'utente e convertirli in una struttura dati JSON.
      I comandi possono essere di tipo:
      - create: creazione di un nuovo evento
      - read: lettura/visualizzazione di eventi esistenti
      - update: modifica di un evento esistente
      - delete: eliminazione di un evento
      - query: interrogazione sul calendario
      
      Rispondi SOLO con un oggetto JSON valido che include:
      - intent: l'intento del comando
      - eventData: dati dell'evento
      - timeData: dati temporali
      - queryData: dati per interrogazioni
      `
    },
    
    // Mappature per le parole chiave in italiano
    keywords: {
      create: ['crea', 'aggiungi', 'nuovo', 'pianifica', 'programma', 'organizza', 'fissa', 'inserisci'],
      read: ['mostra', 'visualizza', 'vedi', 'dammi', 'elenca', 'trova', 'cerca'],
      update: ['modifica', 'aggiorna', 'cambia', 'sposta', 'posticipa', 'anticipa', 'rinvia', 'rinomina'],
      delete: ['elimina', 'cancella', 'rimuovi', 'togli']
    },
    
    // Impostazioni per la gestione delle ambiguità
    ambiguityHandling: {
      requestClarification: true,  // Se true, richiede chiarimenti all'utente in caso di ambiguità
      guessWithWarning: true,      // Se true, tenta di indovinare ma avvisa l'utente
      maxGuessConfidence: 0.8      // Confidenza massima per un tentativo di indovinare
    }
  };
  
  export default parserConfig;