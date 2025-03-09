import ParserInterface from '../interfaces/ParserInterface';
import CommandSchema from '../models/CommandSchema';

/**
 * Implementazione del parser basata su Gemini (Google AI)
 */
export class LLMParser extends ParserInterface {
  constructor(config = {}) {
    super();
    
    this.config = {
      apiKey: config.apiKey || process.env.GEMINI_API_KEY,
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      ...config
    };
    
    this.isConfigured = !!this.config.apiKey;
  }
  
  async parseCommand(text) {
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
      const prompt = this._buildPrompt(text);
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
            temperature: 0.2,
            topP: 0.8,
            topK: 40
          }
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Errore API Gemini: ${data.error?.message || response.statusText}`);
      }
      
      // Estrai la risposta strutturata
      const content = data.candidates[0]?.content?.parts[0]?.text;
      const structuredResponse = this._parseResponse(content);
      
      // Converti in CommandSchema
      return this._toCommandSchema(structuredResponse, text);
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
  
  async canHandle(text) {
    return this.isConfigured;
  }
  
  async getConfidence(text) {
    return this.isConfigured ? 0.9 : 0.0;
  }
  
  _buildPrompt(text) {
    return `Sei un parser specializzato per un'applicazione di calendario chiamata Calendar AI.
Analizza il seguente comando in italiano e convertilo in un formato JSON strutturato.

Comando: "${text}"

I comandi possono essere di tipo:
- create: creazione di un nuovo evento
- read: lettura/visualizzazione di eventi esistenti
- update: modifica di un evento esistente
- delete: eliminazione di un evento
- query: interrogazione sul calendario

Rispondi con un JSON valido che include:
{
  "intent": "l'intento del comando (create, read, update, delete, query)",
  "confidence": "livello di confidenza nell'interpretazione (0.0-1.0)",
  "eventData": {
    "title": "titolo/nome dell'evento",
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
    "limit": "numero massimo di risultati (default 10)"
  },
  "ambiguities": ["possibili ambiguità"],
  "missingInfo": ["informazioni mancanti"]
}

Non includere nessun altro testo oltre al JSON.`;
  }
  
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
    
    // Converti stringhe di data in oggetti Date
    const convertDates = (data) => {
      const result = { ...data };
      
      ['startDate', 'endDate', 'startTime', 'endTime'].forEach(field => {
        if (result[field] && typeof result[field] === 'string' && result[field] !== 'null') {
          try {
            result[field] = new Date(result[field]);
          } catch (e) {
            console.warn(`Impossibile convertire ${field}: ${result[field]}`);
            result[field] = null;
          }
        } else if (result[field] === 'null') {
          result[field] = null;
        }
      });
      
      if (result.timeRange) {
        if (result.timeRange.start && typeof result.timeRange.start === 'string' && result.timeRange.start !== 'null') {
          try {
            result.timeRange.start = new Date(result.timeRange.start);
          } catch (e) {
            console.warn(`Impossibile convertire timeRange.start: ${result.timeRange.start}`);
            result.timeRange.start = null;
          }
        }
        if (result.timeRange.end && typeof result.timeRange.end === 'string' && result.timeRange.end !== 'null') {
          try {
            result.timeRange.end = new Date(result.timeRange.end);
          } catch (e) {
            console.warn(`Impossibile convertire timeRange.end: ${result.timeRange.end}`);
            result.timeRange.end = null;
          }
        }
      }
      
      return result;
    };
    
    const processedTimeData = convertDates(timeData);
    const processedQueryData = convertDates(queryData);
    
    // Crea lo schema
    const schema = new CommandSchema({
      intent,
      confidence: parseFloat(confidence) || 0,
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

// Esporta un'istanza singleton come default export
const llmParser = new LLMParser();
export default llmParser;