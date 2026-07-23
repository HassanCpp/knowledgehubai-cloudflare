// ─── KnowledgeHubAI Processor Registry Adapter ────────────────────────────────
// Consumes the independent, reusable knowledgehub-document-engine library.

import { processDocument as processDocEngine } from '../lib/knowledgehub-document-engine';
import type { StructuredDocument, ValidationMode } from '../lib/knowledgehub-document-engine';

export interface ProcessorResult {
  text: string;
  mimeType: string;
  structuredDoc: StructuredDocument;
}

export async function processDocument(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  openAIApiKey: string,
  validationMode: ValidationMode = 'code'
): Promise<ProcessorResult> {
  const structuredDoc = await processDocEngine(buffer, {
    filename,
    mimeType,
    options: {
      openAIApiKey,
      validationMode,
      ocrDetail: 'high',
      maxFileSizeMB: 5,
    },
  });

  return {
    text: structuredDoc.text,
    mimeType,
    structuredDoc,
  };
}
