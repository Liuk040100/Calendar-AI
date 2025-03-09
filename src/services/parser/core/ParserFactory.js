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
      
      // Se usare esclusivamente il parser regex
      useRegexOnly: config.useRegexOnly || true,
      
      // Configurazione per LLM
      llm: {
        apiKey: config.llmApiKey || null,
        endpoint: config.llmEndpoint || 'https://api.openai.com/v1',
        model: config.llmModel || 'gpt-3.5-turbo',
        maxTokens: config.llmMaxTokens || 150,
        temperature: config.llmTemperature || 0.2
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
      this.llmParser = new LLMParser(this.config.llm);
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
    // Se è configurato per usare solo regex, restituisci quello
    if (this.config.useRegexOnly || !this.isLLMConfigured) {
      console.debug('Usando RegexParser (configurazione: useRegexOnly)');
      return {
        parser: this.regexParser,
        method: 'regex'
      };
    }
    
    // Altrimenti, confronta la confidenza dei due parser
    const regexConfidence = await this.regexParser.getConfidence(text);
    const llmConfidence = await this.llmParser.getConfidence(text);
    
    console.debug('Confronto confidenza:', { 
      regex: regexConfidence, 
      llm: llmConfidence, 
      threshold: this.config.confidenceThreshold 
    });
    
    // Se il parser regex ha sufficiente confidenza, usalo
    if (regexConfidence >= this.config.confidenceThreshold && 
        (regexConfidence >= llmConfidence || this.config.useRegexFallback)) {
      console.debug('Usando RegexParser (maggiore confidenza)');
      return {
        parser: this.regexParser,
        method: 'regex'
      };
    }
    
    // Altrimenti, usa l'LLM
    console.debug('Usando LLMParser');
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
    const { parser } = await this.getBestParser(text);
    
    // Analizza il comando
    const result = await parser.parseCommand(text);
    console.debug('ParserFactory risultato parsing:', result);
    
    return result;
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
      // Crea una nuova istanza di LLMParser con la configurazione aggiornata
      this.llmParser = new LLMParser({
        ...this.config.llm,
        ...newConfig.llm
      });
      
      this.isLLMConfigured = !!this.config.llm.apiKey && !this.config.useRegexOnly;
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
      confidenceThreshold: this.config.confidenceThreshold
    };
  }
}
// Alla fine del file ParserFactory.js
const parserFactory = new ParserFactory();
export default parserFactory;