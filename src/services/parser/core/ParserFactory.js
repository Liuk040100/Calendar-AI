// Importa le istanze singleton
import regexParser from '../implementations/RegexParser';
import llmParser from '../implementations/LLMParser';

/**
 * Factory per la creazione e selezione del parser appropriato
 * Questa classe gestisce la creazione dei parser e seleziona quello più adatto
 * in base alla configurazione e al tipo di comando.
 */
export class ParserFactory {
  constructor(config = {}) {
    this.config = {
      // Se usare il parser regex anche quando è disponibile LLM
      useRegexFallback: config.useRegexFallback || true,
      
      // Se usare esclusivamente il parser regex - Modificato a false come default
      useRegexOnly: config.useRegexOnly || false,
      
      // Configurazione per LLM
      llm: {
        apiKey: config.llmApiKey || import.meta.env.VITE_GEMINI_API_KEY,
        endpoint: config.llmEndpoint || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        maxTokens: config.llmMaxTokens || 1024,
        temperature: config.llmTemperature || 0.2,
        ...config.llm
      },
      
      // Soglia di confidenza per accettare l'interpretazione
      confidenceThreshold: config.confidenceThreshold || 0.6,
      
      ...config
    };
    
    console.debug('ParserFactory inizializzato con config:', { 
      useRegexOnly: this.config.useRegexOnly, 
      useRegexFallback: this.config.useRegexFallback,
      llmConfigured: !!this.config.llm.apiKey
    });
    
    // Utilizza le istanze singleton
    this.regexParser = regexParser;
    this.llmParser = llmParser;
    
    // Aggiorna la configurazione del LLM parser
    if (this.config.llm && this.config.llm.apiKey) {
      this.llmParser.config = {
        ...this.llmParser.config,
        ...this.config.llm
      };
      this.llmParser.isConfigured = !!this.config.llm.apiKey;
    }
    
    // Indica se l'LLM è configurato correttamente
    this.isLLMConfigured = !!this.config.llm.apiKey && !this.config.useRegexOnly;
  }
  
  /**
   * Ottiene il parser più adatto per il comando specificato
   * @param {string} text - Il testo del comando
   * @returns {Promise<Object>} - Oggetto con parser e metodo scelto
   */
  async getBestParser(text) {
    // Se LLM non è configurato o è configurato per usare solo regex, usa regex
    if (!this.isLLMConfigured || this.config.useRegexOnly) {
      console.debug('Usando RegexParser (LLM non configurato o useRegexOnly=true)');
      return {
        parser: this.regexParser,
        method: 'regex'
      };
    }
    
    // Preferisci LLM per default
    console.debug('Usando LLMParser (configurazione predefinita)');
    return {
      parser: this.llmParser,
      method: 'llm'
    };
  }
  
  /**
   * Analizza il comando utilizzando il parser più adatto
   * @param {string} text - Il testo del comando
   * @returns {Promise<import('./models/CommandSchema').CommandSchema>} - Oggetto schema del comando analizzato
   */
  async parseCommand(text) {
    console.debug('ParserFactory.parseCommand chiamato con:', text);
    
    // Ottieni il parser più adatto
    const { parser, method } = await this.getBestParser(text);
    
    try {
      // Analizza il comando
      const result = await parser.parseCommand(text);
      console.debug(`ParserFactory risultato parsing (${method}):`, result);
      
      // Se il parser LLM fallisce, prova con regex come fallback
      if (method === 'llm' && (!result.intent || !result.isValid) && this.config.useRegexFallback) {
        console.debug('Tentativo di parsing con RegexParser come fallback');
        try {
          const regexResult = await this.regexParser.parseCommand(text);
          
          // Se il fallback ha risultati migliori, usalo
          if (regexResult.intent && (regexResult.isValid || !result.isValid)) {
            console.debug('Fallback a RegexParser riuscito');
            return regexResult;
          }
        } catch (fallbackError) {
          console.debug('Fallback a RegexParser fallito:', fallbackError);
        }
      }
      
      return result;
    } catch (error) {
      console.error(`Errore durante il parsing con ${method}:`, error);
      
      // Se c'è un errore e stiamo usando LLM, prova con regex
      if (method === 'llm' && this.config.useRegexFallback) {
        console.debug('Tentativo di parsing con RegexParser dopo errore');
        try {
          return await this.regexParser.parseCommand(text);
        } catch (fallbackError) {
          console.error('Anche il parsing di fallback è fallito:', fallbackError);
        }
      }
      
      // Restituisci uno schema vuoto in caso di errore
      return {
        intent: null,
        isValid: false,
        parsingMetadata: {
          method,
          rawText: text,
          ambiguities: [`Errore durante il parsing: ${error.message}`],
          missingInfo: []
        }
      };
    }
  }
  
  /**
   * Aggiorna la configurazione del factory
   * @param {Object} newConfig - Nuove impostazioni di configurazione
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    console.debug('ParserFactory config aggiornata:', newConfig);
    
    // Aggiorna la configurazione dell'LLM parser se necessario
    if (newConfig.llm) {
      this.llmParser.config = {
        ...this.llmParser.config,
        ...newConfig.llm
      };
      
      this.llmParser.isConfigured = !!this.llmParser.config.apiKey;
      this.isLLMConfigured = this.llmParser.isConfigured && !this.config.useRegexOnly;
    }
  }
  
  /**
   * Restituisce lo stato corrente del factory
   * @returns {Object} - Stato del factory
   */
  getStatus() {
    return {
      useRegexOnly: this.config.useRegexOnly,
      isLLMConfigured: this.isLLMConfigured,
      confidenceThreshold: this.config.confidenceThreshold,
      llmApiConfigured: !!this.config.llm.apiKey
    };
  }
}

// Esporta un'istanza singleton
const parserFactory = new ParserFactory();
export default parserFactory;