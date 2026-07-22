const openai = require('../config/openai');
const BaseProcessor = require('./BaseProcessor');

class ImageProcessor extends BaseProcessor {
  /**
   * Extracts text, tables, captions, and object lists from an image buffer using GPT Vision.
   * @param {Buffer} fileBuffer 
   * @param {string} originalName 
   * @returns {Promise<Object>} Extracted document content
   */
  async extract(fileBuffer, originalName) {
    try {
      const mimeType = originalName.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const base64Image = fileBuffer.toString('base64');

      console.log(`Sending image "${originalName}" to GPT-4o Vision for extraction...`);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are an advanced document OCR and Vision parser.
Analyze this image file. Perform the following tasks:
1. Extract ALL readable text exactly as printed.
2. If there are tables, extract and structure them as Markdown tables.
3. List major objects, logos, diagrams, or charts detected in the image.
4. Provide a descriptive visual caption for the image.
5. Identify any invoice metadata if this image looks like an invoice (e.g. Invoice Number, Total, Tax, Vendor).

Format your output in a clear structured report with headers:
# CAPTION: [Brief caption]
# DETECTED OBJECTS: [List of objects]
# EXTRACTED TEXT:
[Insert text here]
# TABLES:
[Insert markdown tables here]`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      });

      const extractedText = response.choices[0].message.content;
      const cleanedText = this.clean(extractedText);

      return {
        text: cleanedText,
        pageCount: 1,
        metadata: {
          originalName,
          format: 'image',
          mimeType,
        },
      };
    } catch (error) {
      console.error('ImageProcessor Extraction Error:', error.message);
      throw new Error(`Failed to perform Vision extraction on image: ${error.message}`);
    }
  }
}

module.exports = ImageProcessor;
