const { PDFParse } = require('pdf-parse');
const BaseProcessor = require('./BaseProcessor');

class PDFProcessor extends BaseProcessor {
  /**
   * Extracts text from a Digital PDF file buffer.
   * @param {Buffer} fileBuffer 
   * @param {string} originalName 
   * @returns {Promise<Object>} Extracted document content
   */
  async extract(fileBuffer, originalName) {
    let parser;
    try {
      parser = new PDFParse({ data: fileBuffer, verbosity: 0 });
      const textResult = await parser.getText();
      const infoResult = await parser.getInfo();

      const rawText = textResult.text;
      const cleanedText = this.clean(rawText);
      const pageCount = textResult.total || infoResult.total || 1;

      // Simple heuristic: if a PDF has pages but virtually no text, it is likely scanned.
      if (pageCount > 0 && cleanedText.length / pageCount < 50) {
        console.warn(`PDF "${originalName}" has very low text density. Rerouting warning: might require OCR.`);
      }

      return {
        text: cleanedText,
        pageCount,
        metadata: {
          originalName,
          info: infoResult.info,
          metadata: infoResult.metadata,
        },
      };
    } catch (error) {
      console.error('PDFProcessor Extraction Error:', error.message);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    } finally {
      if (parser) {
        await parser.destroy().catch(() => {});
      }
    }
  }
}

module.exports = PDFProcessor;
