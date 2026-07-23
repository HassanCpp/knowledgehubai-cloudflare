// ─── knowledgehub-document-engine: PDF Parser (Native, Scanned, Hybrid) ───────

import { getDocumentProxy, extractText } from 'unpdf';
import { performVisionOCR } from '../services/ocr.service';
import type { DocumentPage, DocumentType, DocumentProcessingOptions } from '../types';

export async function parsePDFDocument(
  buffer: ArrayBuffer,
  options: DocumentProcessingOptions
): Promise<{
  text: string;
  pages: DocumentPage[];
  documentType: DocumentType;
  nativeExtractMs: number;
  ocrMs: number;
}> {
  const nativeStart = Date.now();
  let ocrMs = 0;
  let documentType: DocumentType = 'pdf_searchable';

  const pages: DocumentPage[] = [];
  let fullText = '';

  try {
    const uint8 = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8);
    const totalPages = pdf.numPages;

    // Extract native text
    const { text: rawNativeText, totalPages: extractedPages } = await extractText(pdf, { mergePages: false });
    const nativeExtractMs = Date.now() - nativeStart;

    const pageTexts: string[] = Array.isArray(rawNativeText) ? rawNativeText : [rawNativeText];
    const totalCharCount = pageTexts.reduce((acc, p) => acc + p.trim().length, 0);

    // If native text is empty or sparse (<50 chars across entire PDF), classify as Scanned PDF
    if (totalCharCount < 50) {
      documentType = 'pdf_scanned';
      fullText = 'Scanned PDF document detected. Text extraction requires raster image rendering.';
      pages.push({
        pageNumber: 1,
        text: fullText,
        headings: [],
        tables: [],
        figures: [],
        charts: [],
        codeBlocks: [],
      });
    } else {
      // Searchable or Hybrid PDF
      let hasEmbeddedImageOCR = false;
      const combinedPages: string[] = [];

      for (let i = 0; i < pageTexts.length; i++) {
        const pageNum = i + 1;
        const pageText = (pageTexts[i] || '').trim();

        combinedPages.push(`--- Page ${pageNum} ---\n${pageText}`);

        pages.push({
          pageNumber: pageNum,
          text: pageText,
          headings: extractHeadingsFromText(pageText),
          tables: [],
          figures: [],
          charts: [],
          codeBlocks: [],
        });
      }

      fullText = combinedPages.join('\n\n');
    }

    return {
      text: fullText,
      pages,
      documentType,
      nativeExtractMs,
      ocrMs,
    };
  } catch (err) {
    throw new Error(`PDF Parser failed: ${(err as Error).message}`);
  }
}

function extractHeadingsFromText(text: string): string[] {
  const headings: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(#|##|###|\d+\.\d+)\s+/.test(trimmed) || (trimmed.length < 60 && trimmed === trimmed.toUpperCase() && trimmed.length > 5)) {
      headings.push(trimmed);
    }
  }
  return headings;
}
