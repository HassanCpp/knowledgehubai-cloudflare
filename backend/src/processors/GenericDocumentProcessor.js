const BaseProcessor = require('./BaseProcessor');

class GenericDocumentProcessor extends BaseProcessor {
  /**
   * Extracts text from general/unknown format files, treating them as utf-8 text.
   */
  async extract(fileBuffer, originalName) {
    const rawText = fileBuffer.toString('utf-8');
    const cleanedText = this.clean(rawText);

    return {
      text: cleanedText,
      pageCount: 1,
      metadata: {
        originalName,
        format: 'generic-text',
      },
    };
  }
}

module.exports = GenericDocumentProcessor;
