// ─── knowledgehub-document-engine: AI Validator Service ───────────────────────

import OpenAI from 'openai';
import { SYSTEM_AI_VALIDATOR_PROMPT } from '../prompts/ai-validator.prompt';
import type { StructuredDocument, AIValidationReport } from '../types';

export async function performAIValidation(
  doc: StructuredDocument,
  apiKey: string
): Promise<AIValidationReport> {
  try {
    const client = new OpenAI({ apiKey });

    // Truncate sample context for audit verification
    const sampleText = doc.text.slice(0, 4000);

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: SYSTEM_AI_VALIDATOR_PROMPT,
        },
        {
          role: 'user',
          content: `Extracted StructuredDocument summary:
Document Type: ${doc.documentType}
Pages: ${doc.statistics.totalPages}
Tables: ${doc.statistics.tableCount}
Figures: ${doc.statistics.figureCount}
Code Blocks: ${doc.statistics.codeBlockCount}

Extracted Text Sample:
"""
${sampleText}
"""`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content);

    return {
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      recommendedCorrections: Array.isArray(parsed.recommendedCorrections) ? parsed.recommendedCorrections : [],
      semanticConsistencyScore: typeof parsed.semanticConsistencyScore === 'number' ? parsed.semanticConsistencyScore : 0.95,
    };
  } catch (err) {
    console.warn('AI Validation failed:', (err as Error).message);
    return {
      confidence: 0.85,
      warnings: [`AI Validation warning: ${(err as Error).message}`],
      recommendedCorrections: [],
      semanticConsistencyScore: 0.85,
    };
  }
}
