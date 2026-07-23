// ─── knowledgehub-document-engine: Master Parser Registry ─────────────────────

import { parsePDFDocument } from './pdf.parser';
import { parseDOCXDocument } from './docx.parser';
import { parsePPTXDocument } from './pptx.parser';
import { parseCSVDocument, parseExcelDocument } from './spreadsheet.parser';
import { parseImageDocument } from './image.parser';
import { extractCodeAndMathBlocks } from './code-math.parser';
import type { DocumentType, DocumentProcessingOptions, StructuredDocument } from '../types';

export async function parseDocumentToRaw(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  options: DocumentProcessingOptions
): Promise<{
  text: string;
  documentType: DocumentType;
  pages: StructuredDocument['pages'];
  tables: StructuredDocument['tables'];
  figures: StructuredDocument['figures'];
  charts: StructuredDocument['charts'];
  codeBlocks: StructuredDocument['codeBlocks'];
  warnings: string[];
  nativeExtractMs: number;
  ocrMs: number;
}> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  let text = '';
  let documentType: DocumentType = 'unknown';
  let pages: StructuredDocument['pages'] = [];
  let tables: StructuredDocument['tables'] = [];
  let figures: StructuredDocument['figures'] = [];
  let charts: StructuredDocument['charts'] = [];
  let codeBlocks: StructuredDocument['codeBlocks'] = [];
  let warnings: string[] = [];
  let nativeExtractMs = 0;
  let ocrMs = 0;

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    const pdfRes = await parsePDFDocument(buffer, options);
    text = pdfRes.text;
    documentType = pdfRes.documentType;
    pages = pdfRes.pages;
    nativeExtractMs = pdfRes.nativeExtractMs;
    ocrMs = pdfRes.ocrMs;
  } else if (ext === 'docx' || ext === 'doc' || mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
    documentType = 'docx';
    const docxRes = await parseDOCXDocument(buffer, options);
    text = docxRes.text;
    pages = docxRes.pages;
    tables = docxRes.tables;
    nativeExtractMs = docxRes.nativeExtractMs;
    ocrMs = docxRes.ocrMs;
  } else if (ext === 'pptx' || ext === 'ppt' || mimeType.includes('presentationml') || mimeType.includes('powerpoint')) {
    documentType = 'pptx';
    const pptxRes = await parsePPTXDocument(buffer, options);
    text = pptxRes.text;
    pages = pptxRes.pages;
    nativeExtractMs = pptxRes.nativeExtractMs;
    ocrMs = pptxRes.ocrMs;
  } else if (ext === 'csv' || mimeType === 'text/csv') {
    documentType = 'csv';
    const csvRes = parseCSVDocument(buffer);
    text = csvRes.text;
    pages = csvRes.pages;
    tables = csvRes.tables;
  } else if (ext === 'xlsx' || ext === 'xls' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    documentType = 'excel';
    const excelRes = parseExcelDocument(buffer);
    text = excelRes.text;
    pages = excelRes.pages;
    tables = excelRes.tables;
  } else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff', 'bmp'].includes(ext) || mimeType.startsWith('image/')) {
    documentType = 'image';
    const imgRes = await parseImageDocument(buffer, mimeType, options);
    text = imgRes.text;
    pages = imgRes.pages;
    figures = imgRes.figures;
    charts = imgRes.charts;
    tables = imgRes.tables;
    ocrMs = imgRes.ocrMs;
    warnings = imgRes.warnings;
  } else if (ext === 'md' || mimeType === 'text/markdown') {
    documentType = 'markdown';
    text = new TextDecoder('utf-8').decode(buffer);
    pages = [{ pageNumber: 1, text, headings: [], tables: [], figures: [], charts: [], codeBlocks: [] }];
  } else {
    documentType = 'text';
    text = new TextDecoder('utf-8').decode(buffer);
    pages = [{ pageNumber: 1, text, headings: [], tables: [], figures: [], charts: [], codeBlocks: [] }];
  }

  // Extract code blocks and math equations
  const { cleanedText, codeBlocks: extractedCode } = extractCodeAndMathBlocks(text);
  text = cleanedText;
  codeBlocks = extractedCode;

  return {
    text,
    documentType,
    pages,
    tables,
    figures,
    charts,
    codeBlocks,
    warnings,
    nativeExtractMs,
    ocrMs,
  };
}
