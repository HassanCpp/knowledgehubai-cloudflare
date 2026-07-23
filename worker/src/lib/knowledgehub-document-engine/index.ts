// ─── knowledgehub-document-engine: Master Public API ──────────────────────────

import { parseDocumentToRaw } from './parsers/registry';
import { validateStructuredDocument } from './services/rule-validator';
import { performAIValidation } from './services/ai-validator';
import type { StructuredDocument, DocumentInput } from './types';

export * from './types';

/**
 * Main public entrypoint for processing any document format.
 *
 * @param buffer Raw document file ArrayBuffer
 * @param input Input options including filename, mimeType, and options
 * @returns Fully extracted, validated StructuredDocument payload
 */
export async function processDocument(
  buffer: ArrayBuffer,
  input: DocumentInput
): Promise<StructuredDocument> {
  const startTime = Date.now();
  const { options } = input;
  const maxBytes = (options.maxFileSizeMB ?? 5) * 1024 * 1024;

  if (buffer.byteLength > maxBytes) {
    throw new Error(`File size ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB exceeds maximum allowed limit of ${options.maxFileSizeMB ?? 5}MB.`);
  }

  // 1. Initial Parsing
  let parsed = await parseDocumentToRaw(buffer, input.filename, input.mimeType, options);

  // Build initial StructuredDocument candidate
  let structuredDoc: StructuredDocument = buildDocumentObject(buffer, input, parsed, startTime, false);

  // 2. Rule Validation (Mandatory)
  let ruleReport = validateStructuredDocument(structuredDoc, false);

  // 3. One-time Retry Logic if Rule Validation fails
  if (!ruleReport.isValid) {
    console.warn(`Rule Validation failed for ${input.filename}. Retrying extraction once...`);
    try {
      parsed = await parseDocumentToRaw(buffer, input.filename, input.mimeType, options);
      structuredDoc = buildDocumentObject(buffer, input, parsed, startTime, true);
      ruleReport = validateStructuredDocument(structuredDoc, true);
    } catch (retryErr) {
      structuredDoc.warnings.push(`Extraction retry attempt encountered error: ${(retryErr as Error).message}`);
    }
  }

  structuredDoc.validation.ruleValidation = ruleReport;

  // 4. AI Validation (Optional)
  if (options.validationMode === 'ai' && options.openAIApiKey) {
    const aiValStart = Date.now();
    const aiReport = await performAIValidation(structuredDoc, options.openAIApiKey);
    structuredDoc.validation.aiValidation = aiReport;
    structuredDoc.processingTime.aiValidationMs = Date.now() - aiValStart;
  }

  structuredDoc.processingTime.totalMs = Date.now() - startTime;
  return structuredDoc;
}

function buildDocumentObject(
  buffer: ArrayBuffer,
  input: DocumentInput,
  parsed: Awaited<ReturnType<typeof parseDocumentToRaw>>,
  startTime: number,
  retryAttempted: boolean
): StructuredDocument {
  const words = parsed.text.split(/\s+/).filter((w) => w.length > 0);
  const totalCharacters = parsed.text.length;
  const totalWords = words.length;

  return {
    documentType: parsed.documentType,
    metadata: {
      filename: input.filename,
      originalName: input.filename,
      mimeType: input.mimeType,
      sizeBytes: buffer.byteLength,
      title: input.filename.split('.').slice(0, -1).join('.'),
      language: 'en',
    },
    pages: parsed.pages,
    text: parsed.text,
    tables: parsed.tables,
    figures: parsed.figures,
    charts: parsed.charts,
    codeBlocks: parsed.codeBlocks,
    warnings: [...parsed.warnings],
    validation: {
      ruleValidation: {
        isValid: true,
        retryAttempted,
        warnings: [],
        errors: [],
        checks: {
          emptyText: false,
          missingTitle: false,
          duplicatePages: false,
          duplicateParagraphs: false,
          tableSyntaxValid: true,
          statisticsValid: true,
        },
      },
    },
    statistics: {
      totalWords,
      totalCharacters,
      totalPages: parsed.pages.length,
      tableCount: parsed.tables.length,
      figureCount: parsed.figures.length,
      chartCount: parsed.charts.length,
      codeBlockCount: parsed.codeBlocks.length,
    },
    processingTime: {
      totalMs: Date.now() - startTime,
      nativeExtractMs: parsed.nativeExtractMs,
      ocrMs: parsed.ocrMs,
      ruleValidationMs: 1,
      aiValidationMs: 0,
    },
  };
}
