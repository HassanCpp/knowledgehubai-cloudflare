const classifierService = require('../services/classifier.service');
const adaptiveChunker = require('../chunkers/AdaptiveChunker');
const indexingService = require('../services/indexing.service');

class BaseProcessor {
  /**
   * Cleans raw text of unnecessary control codes, repeated spaces, and binary artifacts.
   * @param {string} text 
   * @returns {string} Cleaned text
   */
  clean(text) {
    if (!text) return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/ {2,}/g, ' ') // Collapse multiple spaces
      .replace(/\n{3,}/g, '\n\n') // Collapse long empty lines
      .trim();
  }

  /**
   * Identifies the category of the document.
   * @param {string} text 
   * @returns {Promise<string>} Classification type
   */
  async classify(text) {
    return classifierService.classify(text);
  }

  /**
   * Splits text into hierarchical chunks based on structure and classification.
   * @param {string} text 
   * @param {string} classification 
   * @returns {Array<Object>} List of structured chunks
   */
  chunk(text, classification) {
    return adaptiveChunker.chunk(text, classification);
  }

  /**
   * Enrich chunks with extra metadata (keywords, base document summaries).
   * Exists for future expansion.
   * @param {Array<Object>} chunks 
   * @param {Object} document 
   * @returns {Promise<Array<Object>>}
   */
  async enrich(chunks, document) {
    return chunks;
  }

  /**
   * Coordinates embedding and saving vector index mappings.
   * @param {Object} document 
   * @param {Array<Object>} chunks 
   */
  async index(document, chunks) {
    return indexingService.indexChunks(document, chunks);
  }
}

module.exports = BaseProcessor;
