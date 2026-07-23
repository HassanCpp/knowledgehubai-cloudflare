// ─── knowledgehub-document-engine: DOCX Parser ─────────────────────────────────

import { unzipSync } from 'fflate';
import { performVisionOCR } from '../services/ocr.service';
import type { DocumentPage, DocumentProcessingOptions, ExtractedTable } from '../types';

export async function parseDOCXDocument(
  buffer: ArrayBuffer,
  options: DocumentProcessingOptions
): Promise<{
  text: string;
  pages: DocumentPage[];
  tables: ExtractedTable[];
  nativeExtractMs: number;
  ocrMs: number;
}> {
  const nativeStart = Date.now();
  let ocrMs = 0;
  const tables: ExtractedTable[] = [];

  try {
    const uint8 = new Uint8Array(buffer);
    const files = unzipSync(uint8);

    const docXmlBytes = files['word/document.xml'];
    if (!docXmlBytes) throw new Error('word/document.xml not found in DOCX archive');

    const xml = new TextDecoder('utf-8').decode(docXmlBytes);

    // 1. Native text & table XML parsing
    let cleanText = xml
      .replace(/<w:br[^>]*\/>/gi, '\n')
      .replace(/<\/w:p>/gi, '\n')
      .replace(/<\/w:tc>/gi, '\t')
      .replace(/<\/w:tr>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&#x[0-9A-Fa-f]+;/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const nativeExtractMs = Date.now() - nativeStart;

    // 2. Extract embedded image assets in word/media/ and run OCR
    const mediaFiles = Object.keys(files).filter((path) => /^word\/media\/image\d+\.(png|jpg|jpeg|webp)$/i.test(path));
    if (mediaFiles.length > 0 && options.openAIApiKey) {
      const ocrStart = Date.now();
      const ocrResults: string[] = [];

      for (const mediaPath of mediaFiles.slice(0, 5)) { // process up to 5 embedded media files
        const imageBytes = files[mediaPath];
        const ext = mediaPath.split('.').pop()?.toLowerCase() || 'png';
        const mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        const imageOcrText = await performVisionOCR(imageBytes.buffer, mime, options.openAIApiKey, options.ocrDetail);
        if (imageOcrText) {
          ocrResults.push(`[EMBEDDED_IMAGE_OCR: ${mediaPath}]\n${imageOcrText}`);
        }
      }

      ocrMs = Date.now() - ocrStart;
      if (ocrResults.length > 0) {
        cleanText += '\n\n' + ocrResults.join('\n\n');
      }
    }

    const pages: DocumentPage[] = [
      {
        pageNumber: 1,
        text: cleanText,
        headings: [],
        tables,
        figures: [],
        charts: [],
        codeBlocks: [],
      },
    ];

    return {
      text: cleanText,
      pages,
      tables,
      nativeExtractMs,
      ocrMs,
    };
  } catch (err) {
    throw new Error(`DOCX Parser failed: ${(err as Error).message}`);
  }
}
