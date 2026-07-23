// ─── Document Processor Registry ─────────────────────────────────────────────
// Maps file extensions and MIME types to the correct WASM processor.

import { parsePDF } from './pdf.processor';
import { parseDOCX } from './docx.processor';
import { parseExcel } from './excel.processor';
import { parseCSV } from './csv.processor';
import { parseHTML } from './html.processor';
import { parseImage } from './image.processor';
import { parseMarkdown } from './markdown.processor';
import { parseText } from './text.processor';
import { parsePPTX } from './presentation.processor';

export interface ProcessorResult {
  text: string;
  mimeType: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB hard cap (free plan CPU budget)

export async function processDocument(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  openAIApiKey: string
): Promise<ProcessorResult> {
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(`File exceeds 5 MB limit (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). Please split the file.`);
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  let text = '';

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    text = await parsePDF(buffer);
  } else if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    text = parseDOCX(buffer);
  } else if (ext === 'xlsx' || ext === 'xls' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    text = parseExcel(buffer);
  } else if (ext === 'csv' || mimeType === 'text/csv') {
    text = parseCSV(buffer);
  } else if (ext === 'html' || ext === 'htm' || mimeType === 'text/html') {
    text = parseHTML(buffer);
  } else if (ext === 'md' || mimeType === 'text/markdown') {
    text = parseMarkdown(buffer);
  } else if (ext === 'txt' || mimeType === 'text/plain') {
    text = parseText(buffer);
  } else if (ext === 'pptx' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    text = parsePPTX(buffer);
  } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) || mimeType.startsWith('image/')) {
    text = await parseImage(buffer, mimeType, openAIApiKey);
  } else {
    // Fallback: try plain text decode
    text = parseText(buffer);
  }

  if (!text || text.length < 10) {
    throw new Error(`Could not extract meaningful text from ${filename}`);
  }

  return { text, mimeType };
}
