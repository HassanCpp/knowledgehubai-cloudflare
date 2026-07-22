const openai = require('../config/openai');

class ClassifierService {
  /**
   * Classifies a document based on its text snippet.
   * @param {string} textSample The starting text of the document
   * @returns {Promise<string>} One of: 'Invoice', 'Research Paper', 'Book', 'Manual', 'FAQ', 'Contract', 'Presentation', 'Policy', 'Resume', 'Spreadsheet', 'Product Catalog', 'Generic'
   */
  async classify(textSample) {
    if (!textSample || textSample.trim().length === 0) {
      return 'Generic';
    }

    try {
      const prompt = `You are a document classifier for an enterprise RAG system.
Analyze the following document snippet (which might contain headers, contents, and structure) and classify the document into exactly one of these categories:
- Invoice
- Research Paper
- Book
- Manual
- FAQ
- Contract
- Presentation
- Policy
- Resume
- Spreadsheet
- Product Catalog
- Code-Blocks
- Generic

Do not output any explanation. Only output the category name.

Document Snippet:
"""
${textSample.substring(0, 2000)}
"""`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 10,
      });

      const classification = response.choices[0].message.content.trim();
      const validCategories = [
        'Invoice', 'Research Paper', 'Book', 'Manual', 'FAQ',
        'Contract', 'Presentation', 'Policy', 'Resume',
        'Spreadsheet', 'Product Catalog', 'Code-Blocks', 'Generic'
      ];

      if (validCategories.includes(classification)) {
        return classification;
      }

      // Check if it matches after lowercasing
      const found = validCategories.find(
        (cat) => cat.toLowerCase() === classification.toLowerCase()
      );
      return found || 'Generic';
    } catch (error) {
      console.error('Classification Service Error:', error.message);
      return 'Generic'; // Fallback
    }
  }
}

module.exports = new ClassifierService();
