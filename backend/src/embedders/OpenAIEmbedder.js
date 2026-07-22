const openai = require('../config/openai');

class OpenAIEmbedder {
  /**
   * Generates a 1536-dimension vector embedding for a given text.
   * @param {string} text 
   * @returns {Promise<Array<number>>}
   */
  async embedQuery(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty query text');
    }

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.replace(/\n/g, ' '), // Recommended pre-processing
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating single embedding:', error.message);
      throw error;
    }
  }

  /**
   * Generates embeddings in batch for an array of texts.
   * @param {Array<string>} texts 
   * @returns {Promise<Array<Array<number>>>}
   */
  async embedBatch(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    // Filter and clean texts, keeping mapping indices
    const cleanedTexts = texts.map((t) => (t ? t.replace(/\n/g, ' ') : ' '));

    try {
      // OpenAI supports up to 2048 inputs per request for text-embedding-3-small.
      // We will batch in chunks of 500 to be safe and responsive.
      const batchSize = 500;
      const results = [];

      for (let i = 0; i < cleanedTexts.length; i += batchSize) {
        const batch = cleanedTexts.slice(i, i + batchSize);
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch,
        });
        const embeddings = response.data.map((item) => item.embedding);
        results.push(...embeddings);
      }

      return results;
    } catch (error) {
      console.error('Error in batch embedding:', error.message);
      throw error;
    }
  }
}

module.exports = new OpenAIEmbedder();
