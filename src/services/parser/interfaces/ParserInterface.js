/**
 * Interfaccia per tutti i tipi di parser
 * Questa classe definisce i metodi che ogni implementazione di parser deve fornire.
 * Funziona come un'interfaccia/classe astratta per garantire la coerenza tra diversi tipi di parser.
 */
export class ParserInterface {
    /**
     * Analizza un comando in linguaggio naturale
     * @param {string} text - Il testo del comando da analizzare
     * @returns {Promise<import('../models/CommandSchema').CommandSchema>} - Oggetto schema del comando analizzato
     */
    async parseCommand(text) {
      throw new Error('Il metodo parseCommand deve essere implementato dalle classi derivate');
    }
    
    /**
     * Verifica se il parser può gestire un determinato tipo di comando
     * @param {string} text - Il testo del comando da analizzare
     * @returns {Promise<boolean>} - true se il parser può gestire questo tipo di comando
     */
    async canHandle(text) {
      throw new Error('Il metodo canHandle deve essere implementato dalle classi derivate');
    }
    
    /**
     * Restituisce il livello di confidenza con cui il parser può interpretare questo comando
     * @param {string} text - Il testo del comando da analizzare
     * @returns {Promise<number>} - Valore di confidenza tra 0.0 e 1.0
     */
    async getConfidence(text) {
      throw new Error('Il metodo getConfidence deve essere implementato dalle classi derivate');
    }
}

// Non è necessario un'istanza singleton per l'interfaccia, 
// ma esportiamo l'interfaccia come default export per coerenza
export default ParserInterface;