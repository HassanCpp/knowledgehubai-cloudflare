import OpenAI from 'openai';
import { getSessionSummary, upsertSessionSummary, getAllChatHistoryForSession } from '../db/queries';
import type { Env } from '../types';

export async function getOrUpdateSessionSummary(
  env: Env,
  userId: string,
  sessionId: string
): Promise<string> {
  try {
    const allHistory = await getAllChatHistoryForSession(env.DB, userId, sessionId);
    // If total exchanges <= 6, sliding window covers 100% of context (no summary needed)
    if (allHistory.length <= 6) {
      return '';
    }

    const existingSummaryRow = await getSessionSummary(env.DB, sessionId);

    // Older exchanges to summarize (messages prior to the last 6)
    const olderExchanges = allHistory.slice(0, allHistory.length - 6);
    const olderCount = olderExchanges.length;

    // Check if we already have an up-to-date summary for these older exchanges
    if (existingSummaryRow && existingSummaryRow.last_summarized_count >= olderCount) {
      return existingSummaryRow.summary_text;
    }

    // Trigger gpt-4o-mini summarization of older exchanges
    const conversationText = olderExchanges
      .map((item) => `User: ${item.original_query}\nAssistant: ${item.response_text}`)
      .join('\n\n');

    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a conversation summarization engine. Compress the following older conversation exchanges into a concise 2-3 sentence summary of key user facts, topics discussed, user role/preferences, and background context. Omit greeting small talk.`,
        },
        {
          role: 'user',
          content: conversationText,
        },
      ],
      max_tokens: 200,
    });

    const summaryText = response.choices[0]?.message?.content?.trim() || '';
    if (summaryText) {
      await upsertSessionSummary(env.DB, sessionId, userId, summaryText, olderCount);
    }

    return summaryText;
  } catch (err) {
    console.warn('Session summary extraction failed:', (err as Error).message);
    return '';
  }
}
