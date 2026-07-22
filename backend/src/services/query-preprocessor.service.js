const openai = require('../config/openai');

class QueryPreprocessorService {
  /**
   * Runs the complete pre-processing pipeline in a single structured LLM call.
   * @param {string} originalQuery The raw query typed by the user
   * @param {Array<Object>} history Conversational context (recent messages)
   * @returns {Promise<Object>} Processed query variables: normalizedQuery, rewrittenQuery, intent, constraints, expandedKeywords
   */
  async preprocess(originalQuery, history = []) {
    console.log(`Pre-processing query: "${originalQuery}"`);
    
    // Construct chat history summary string for LLM context
    const historySnippet = history
      .slice(-5) // Get last 5 messages
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: "${msg.content}"`)
      .join('\n');

    const prompt = `You are the query pre-processing engine for an enterprise RAG system.
Your job is to analyze the user's current query, evaluate it against the recent conversation history (if any), and output a structured JSON response containing:
1. "normalizedQuery": The user's query corrected for spelling, slang, and stripped of conversational filler (e.g. "please tell me about", "can you search for"), while fully preserving the search intent.
2. "intent": Classify the query into exactly one of these:
   - Greeting
   - FAQ
   - Policy
   - Product Search
   - Comparison
   - Document Search
   - Summarization
   - Invoice Search
   - Spreadsheet Search
   - Chat
   - Out of Domain
3. "rewrittenQuery": If the query is vague or uses pronouns referencing past chat (e.g. "how do I return it?" when "it" is a laptop discussed earlier), rewrite it into a self-contained question. If the question is already clear, output the normalized query.
4. "constraints": Extract search constraints. Match any values for: price, dates, colors, sizes, invoiceNumbers, organizations, people, documentNames. Return null or empty values for fields not found.
5. "expandedKeywords": List 3-5 synonyms or expanded search terms for the query (e.g. "refund" -> ["refund", "return", "exchange", "money back"]).

Conversation History:
"""
${historySnippet || 'No history.'}
"""

User Current Query: "${originalQuery}"

Return EXACTLY a JSON object matching this schema:
{
  "normalizedQuery": "...",
  "intent": "...",
  "rewrittenQuery": "...",
  "constraints": {
    "price": "...",
    "dates": "...",
    "colors": "...",
    "sizes": "...",
    "invoiceNumbers": "...",
    "organizations": "...",
    "people": "...",
    "documentNames": "..."
  },
  "expandedKeywords": ["...", "..."]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0,
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      console.log(`Preprocess completed. Intent: ${parsed.intent}. Rewritten: "${parsed.rewrittenQuery}"`);
      return parsed;
    } catch (error) {
      console.error('Query Pre-processor Service Failed, returning fallback values:', error.message);
      // Fallback object to keep query pipeline running if OpenAI is offline/rate-limited
      return {
        normalizedQuery: originalQuery,
        intent: 'Chat',
        rewrittenQuery: originalQuery,
        constraints: {},
        expandedKeywords: [originalQuery],
      };
    }
  }
}

module.exports = new QueryPreprocessorService();
