const BaseProcessor = require('./BaseProcessor');

class HTMLProcessor extends BaseProcessor {
  /**
   * Future HTML page parser slot.
   */
  async extract(fileBuffer, originalName) {
    // Standard extraction can convert HTML to text using cheerio
    const cheerio = require('cheerio');
    const $ = cheerio.load(fileBuffer.toString('utf-8'));
    $('script, style, nav, footer, header').remove();
    const cleanedText = this.clean($('body').text());
    
    return {
      text: cleanedText,
      pageCount: 1,
      metadata: {
        originalName,
        format: 'html',
      },
    };
  }
}

module.exports = HTMLProcessor;
