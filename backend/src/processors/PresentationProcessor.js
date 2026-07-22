const officeParser = require('officeparser');
const BaseProcessor = require('./BaseProcessor');

class PresentationProcessor extends BaseProcessor {
  /**
   * Extracts text from a PPTX file buffer.
   * @param {Buffer} fileBuffer 
   * @param {string} originalName 
   * @returns {Promise<Object>} Extracted document content
   */
  async extract(fileBuffer, originalName) {
    try {
      // Parse the PPTX file buffer using officeparser
      // fileType: 'pptx' hint is supplied to ensure buffer parsing is targeted correctly
      const result = await officeParser.parseOffice(fileBuffer, { fileType: 'pptx' });
      
      let rawText = '';
      if (typeof result === 'string') {
        rawText = result;
      } else if (result && typeof result.toText === 'function') {
        rawText = result.toText();
      } else if (result && result.text) {
        rawText = result.text;
      } else if (result) {
        rawText = JSON.stringify(result);
      }

      const cleanedText = this.clean(rawText);

      // Estimate slide count based on line spaces
      const slideSeparatorCount = (cleanedText.match(/\n\n---|\n\n/g) || []).length;
      const pageCount = Math.max(1, Math.ceil(slideSeparatorCount / 2));

      return {
        text: cleanedText,
        pageCount,
        metadata: {
          originalName,
          processor: 'PresentationProcessor',
        },
      };
    } catch (error) {
      console.error('PresentationProcessor Extraction Error:', error.message);
      throw new Error(`Failed to extract text from PowerPoint presentation: ${error.message}`);
    }
  }
}

module.exports = PresentationProcessor;
