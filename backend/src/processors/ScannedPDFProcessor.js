const pdfParse = require('pdf-parse');
const openai = require('../config/openai');
const BaseProcessor = require('./BaseProcessor');

class ScannedPDFProcessor extends BaseProcessor {
  /**
   * Extracts text from a Scanned PDF. For actual scanned PDFs, text is typically
   * garbled or empty. This processor uses pdf-parse to extract raw content, then
   * uses an LLM to clean up the OCR mistakes, reconstruct tables, and extract page structure.
   * @param {Buffer} fileBuffer 
   * @param {string} originalName 
   * @returns {Promise<Object>} Extracted document content
   */
  async extract(fileBuffer, originalName) {
    try {
      const data = await pdfParse(fileBuffer);
      const rawText = data.text;
      
      if (!rawText || rawText.trim().length < 50) {
        throw new Error('This PDF has no extractable text. Please convert it to images and upload if OCR is needed.');
      }

      console.log(`Reconstructing OCR text for scanned PDF "${originalName}" using GPT...`);

      // Call GPT-4o-mini to reconstruct table structures, OCR spelling errors, and layout headers.
      const prompt = `You are an expert OCR cleanup assistant.
We have extracted the following text from a scanned PDF. The text might contain garbled words, bad spacing, broken tables, or poor formatting.
Please clean it up:
1. Fix spelling mistakes caused by OCR.
2. Structure any broken tables into clean Markdown tables.
3. Identify structural section headers.
4. Keep the exact meaning and numerical values intact.

Garbled OCR Text:
"""
${rawText.substring(0, 6000)}
"""`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      const cleanedText = response.choices[0].message.content;
      const finalText = this.clean(cleanedText);

      return {
        text: finalText,
        pageCount: data.numpages || 1,
        metadata: {
          originalName,
          isScanned: true,
          ocrCleaned: true,
        },
      };
    } catch (error) {
      console.error('ScannedPDFProcessor Extraction Error:', error.message);
      throw new Error(`Failed to extract scanned PDF text: ${error.message}`);
    }
  }
}

module.exports = ScannedPDFProcessor;
