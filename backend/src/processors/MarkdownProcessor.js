const BaseProcessor = require('./BaseProcessor');

class MarkdownProcessor extends BaseProcessor {
  /**
   * Extracts text from a Markdown file buffer.
   * @param {Buffer} fileBuffer 
   * @param {string} originalName 
   * @returns {Promise<Object>} Extracted document content
   */
  async extract(fileBuffer, originalName) {
    const rawText = fileBuffer.toString('utf-8');
    const cleanedText = this.clean(rawText);

    return {
      text: cleanedText,
      pageCount: 1,
      metadata: {
        originalName,
        format: 'markdown',
      },
    };
  }
}

module.exports = MarkdownProcessor;
