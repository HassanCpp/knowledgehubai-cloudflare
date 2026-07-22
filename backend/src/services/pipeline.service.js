const ChatHistory = require('../models/ChatHistory');
const FallbackLog = require('../models/FallbackLog');
const QueryLog = require('../models/QueryLog');
const RetrievalLog = require('../models/RetrievalLog');
const UserMemory = require('../models/UserMemory');
const openAIEmbedder = require('../embedders/OpenAIEmbedder');
const cacheManager = require('../caches/CacheManager');
const queryPreprocessorService = require('./query-preprocessor.service');
const multiRetriever = require('../retrievers/MultiRetriever');
const reRanker = require('../rankers/ReRanker');
const contextService = require('./context.service');
const openai = require('../config/openai');

class PipelineService {
  /**
   * Main query execution pipeline that streams answers via SSE.
   */
  async executeQueryStream({ query, userId, sessionId, res }) {
    const pipelineStartTime = Date.now();
    let embeddingTimeMs = 0;
    let retrievalTimeMs = 0;
    let rerankingTimeMs = 0;
    let llmTimeMs = 0;

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    // Helper to send JSON SSE messages
    const sendSSE = (type, data) => {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    try {
      // 1. FAST PATH: Check FAQ Cache
      const faqAnswer = await cacheManager.getFAQCache(query);
      if (faqAnswer) {
        sendSSE('metadata', { intent: 'FAQ', sources: [], cached: true });
        this.streamStringTokens(faqAnswer, sendSSE);
        await this.logChatAndMetrics({ query, responseText: faqAnswer, intent: 'FAQ', userId, sessionId, latency: Date.now() - pipelineStartTime });
        return;
      }

      // 2. FAST PATH: Check Exact Query Cache
      const exactCachedAnswer = await cacheManager.getExactCache(query);
      if (exactCachedAnswer) {
        sendSSE('metadata', { intent: 'FAQ', sources: [], cached: true });
        this.streamStringTokens(exactCachedAnswer, sendSSE);
        await this.logChatAndMetrics({ query, responseText: exactCachedAnswer, intent: 'FAQ', userId, sessionId, latency: Date.now() - pipelineStartTime });
        return;
      }

      // 3. Generate Embedding (used for semantic cache and dense retrieval)
      const embedStart = Date.now();
      const queryEmbedding = await openAIEmbedder.embedQuery(query);
      embeddingTimeMs = Date.now() - embedStart;

      // 4. FAST PATH: Check Semantic Cache
      const semanticCachedAnswer = await cacheManager.getSemanticCache(query, queryEmbedding);
      if (semanticCachedAnswer) {
        sendSSE('metadata', { intent: 'FAQ', sources: [], cached: true });
        this.streamStringTokens(semanticCachedAnswer, sendSSE);
        await this.logChatAndMetrics({ query, responseText: semanticCachedAnswer, intent: 'FAQ', userId, sessionId, latency: Date.now() - pipelineStartTime });
        return;
      }

      // 5. Fetch recent chat history for context
      const chatHistoryList = await ChatHistory.find({ userId, sessionId })
        .sort({ createdAt: -1 })
        .limit(6);
      
      const history = chatHistoryList.reverse().map((ch) => ([
        { role: 'user', content: ch.originalQuery },
        { role: 'assistant', content: ch.responseText },
      ])).flat();

      // 6. Run Pre-processing (Normalization, Intent, Rewrite, Constraints, Synonyms)
      const {
        normalizedQuery,
        intent,
        rewrittenQuery,
        constraints,
        expandedKeywords
      } = await queryPreprocessorService.preprocess(query, history);

      // Extract User long-term memory/preferences in the background
      this.extractUserMemory(userId, query).catch((e) => console.error('Memory extraction error:', e.message));

      // 7. GREETING HANDLING
      if (intent === 'Greeting') {
        const greetingResponse = chatHistoryList.length > 0
          ? 'Welcome back! Let me know what information you need from your documents today.'
          : 'Hello! Welcome to KnowledgeHubAI. I can help you search, analyze, and query your knowledge base. Please ask a question or upload a document to get started.';

        sendSSE('metadata', { intent: 'Greeting', sources: [] });
        this.streamStringTokens(greetingResponse, sendSSE);
        await this.logChatAndMetrics({ query, responseText: greetingResponse, intent, userId, sessionId, latency: Date.now() - pipelineStartTime });
        return;
      }

      // 8. HYBRID MULTI-RETRIEVAL (Dense + Sparse + Constraints)
      const retrievalStart = Date.now();
      let candidates = await multiRetriever.retrieveAndFuse(
        rewrittenQuery,
        queryEmbedding,
        constraints,
        80
      );
      retrievalTimeMs = Date.now() - retrievalStart;

      // Log raw retrieval results
      const queryLogDoc = await QueryLog.create({
        queryText: query,
        processedQuery: rewrittenQuery,
        intent,
        userId,
        responseTimeMs: 0, // Will update later
      });

      await RetrievalLog.create({
        queryId: queryLogDoc._id,
        rawQuery: query,
        retrievedChunks: candidates.map((c, idx) => ({
          chunkId: c.chunkId,
          mongodbChunkId: c.mongodbChunkId,
          score: c.score,
          source: c.source,
          rank: idx + 1,
        })),
        latencyMs: retrievalTimeMs,
      });

      // 9. PARENT-EXPANSION & TWO-STAGE RE-RANKING
      const rerankStart = Date.now();
      const expandedCandidates = await contextService.expandCandidates(candidates);
      let rankedCandidates = await reRanker.rerank(rewrittenQuery, expandedCandidates, 10);
      rerankingTimeMs = Date.now() - rerankStart;

      // 10. CONTEXT BUILDING
      let { contextText, sources } = await contextService.buildContext(rankedCandidates);

      // 11. SELF-REFLECTION & FALLBACK/RETRY
      let isContextSufficient = await contextService.reflectOnContext(normalizedQuery, contextText);

      if (!isContextSufficient && candidates.length > 0) {
        console.log('Self-reflection marked context insufficient. Kicking off dynamic retry (expanding search depth)...');
        
        // Retry with expanded constraints (clear filters, increase retrieval size)
        const retryRetrievalStart = Date.now();
        const retryCandidates = await multiRetriever.retrieveAndFuse(
          expandedKeywords.join(' '), // Expand search keywords
          queryEmbedding,
          {}, // Clear strict category/document metadata filters
          150 // Retrieve a deeper candidate pool
        );
        retrievalTimeMs += (Date.now() - retryRetrievalStart);

        const retryRerankStart = Date.now();
        const expandedRetry = await contextService.expandCandidates(retryCandidates);
        rankedCandidates = await reRanker.rerank(rewrittenQuery, expandedRetry, 12);
        rerankingTimeMs += (Date.now() - retryRerankStart);

        const rebuilt = await contextService.buildContext(rankedCandidates);
        contextText = rebuilt.contextText;
        sources = rebuilt.sources;

        // Perform reflection check again
        isContextSufficient = await contextService.reflectOnContext(normalizedQuery, contextText);
      }

      // If STILL insufficient, we generate a fallback response, and log it for the admin dashboard
      let fallbackTriggered = false;
      if (!isContextSufficient) {
        fallbackTriggered = true;
        console.log('Context remains insufficient after retry. Activating fallback pipeline...');
      }

      // 12. GENERATING RESPONSE AND STREAMING
      sendSSE('metadata', { intent, sources });

      const llmStart = Date.now();
      
      const systemPrompt = fallbackTriggered
        ? `You are an expert AI knowledge manager for KnowledgeHubAI.
The user is asking a question that is NOT fully answered in the uploaded knowledge base documents.
Provide a helpful answer explaining what is missing, and provide the best possible general answer using your pre-trained knowledge.
Explicitly state that this answer is formulated outside the uploaded knowledge base.`
        : `You are an expert AI assistant for KnowledgeHubAI.
Answer the user's question using ONLY the provided verified document Context.
If the Context is not sufficient to answer, state that clearly.
Maintain a highly professional, enterprise-grade tone. Use clear headings and lists.

Document Context:
"""
${contextText}
"""`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: query },
      ];

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: fallbackTriggered ? 0.4 : 0.1,
        stream: true,
      });

      let completeAnswer = '';
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) {
          completeAnswer += token;
          sendSSE('token', { content: token });
        }
      }
      llmTimeMs = Date.now() - llmStart;

      // 13. CACHING SUCCESSFUL RESPONSE
      if (!fallbackTriggered && completeAnswer.length > 50) {
        await cacheManager.setExactCache(query, completeAnswer);
        await cacheManager.setSemanticCache(query, queryEmbedding, completeAnswer);
      }

      // 14. LOGGING AND AUDIT TRAIL
      const totalTimeMs = Date.now() - pipelineStartTime;
      
      // Update QueryLog time
      queryLogDoc.responseTimeMs = totalTimeMs;
      await queryLogDoc.save();

      // Log chat history
      await ChatHistory.create({
        userId,
        sessionId,
        originalQuery: query,
        rewrittenQuery,
        responseText: completeAnswer,
        sources,
        logs: {
          intent,
          totalTimeMs,
          embeddingTimeMs,
          retrievalTimeMs,
          rerankingTimeMs,
          llmTimeMs,
        },
      });

      // If fallback was triggered, write to fallbackLogs
      if (fallbackTriggered) {
        await FallbackLog.create({
          queryText: query,
          reason: 'low_similarity',
          fallbackPrompt: systemPrompt,
          llmResponse: completeAnswer,
          similarityScore: rankedCandidates[0]?.finalScore || 0,
        });
      }

      sendSSE('done', {});
    } catch (error) {
      console.error('Query Pipeline Execution Failure:', error);
      sendSSE('error', { message: error.message || 'Failed to process query' });
    } finally {
      res.end();
    }
  }

  /**
   * Helper to stream pre-recorded string answers token-by-token (SSE simulator for cached hits).
   */
  streamStringTokens(text, sendSSE) {
    const tokens = text.split(/(\s+)/);
    let i = 0;
    const interval = setInterval(() => {
      if (i < tokens.length) {
        sendSSE('token', { content: tokens[i] });
        i++;
      } else {
        sendSSE('done', {});
        clearInterval(interval);
      }
    }, 15);
  }

  /**
   * Background memory extractor to log user facts.
   */
  async extractUserMemory(userId, query) {
    // Basic heuristics: look for "my name is...", "i work at...", "i prefer..."
    const myNameMatch = query.match(/(?:my name is|i am)\s+([a-zA-Z]{2,20})/i);
    const preferenceMatch = query.match(/(?:i prefer|i like)\s+([a-zA-Z0-9\s-]{2,40})/i);

    if (myNameMatch) {
      await UserMemory.findOneAndUpdate(
        { userId, key: 'name' },
        { value: myNameMatch[1].trim() },
        { upsert: true }
      );
    }
    if (preferenceMatch) {
      await UserMemory.findOneAndUpdate(
        { userId, key: 'preference' },
        { value: preferenceMatch[1].trim() },
        { upsert: true }
      );
    }
  }

  /**
   * Quick logging helper.
   */
  async logChatAndMetrics({ query, responseText, intent, userId, sessionId, latency }) {
    await QueryLog.create({
      queryText: query,
      intent,
      userId,
      responseTimeMs: latency,
    });

    await ChatHistory.create({
      userId,
      sessionId,
      originalQuery: query,
      responseText,
      sources: [],
      logs: {
        intent,
        totalTimeMs: latency,
      },
    });
  }
}

module.exports = new PipelineService();
