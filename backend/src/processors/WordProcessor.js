const mammoth = require('mammoth');
const BaseProcessor = require('./BaseProcessor');

class WordProcessor extends BaseProcessor {
  /**
   * Extracts text from a DOCX Microsoft Word file buffer.
   * @param {Buffer} fileBuffer 
   * @param {string} originalName 
   * @returns {Promise<Object>} Extracted document content
   */
  async extract(fileBuffer, originalName) {
    try {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      const rawText = result.value;
      const cleanedText = this.clean(rawText);

      return {
        text: cleanedText,
        pageCount: 1, // Word docs do not map pages strictly in raw text parsing
        metadata: {
          originalName,
          warnings: result.warnings,
        },
      };
    } catch (error) {
      console.error('WordProcessor Extraction Error:', error.message);
      throw new Error(`Failed to extract text from Word document: ${error.message}`);
    }
  }
}

module.exports = WordProcessor;
