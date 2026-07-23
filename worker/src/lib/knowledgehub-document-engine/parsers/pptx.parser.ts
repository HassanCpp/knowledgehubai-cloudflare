// ─── knowledgehub-document-engine: PPTX Parser ─────────────────────────────────

import { unzipSync } from 'fflate';
import { performVisionOCR } from '../services/ocr.service';
import type { DocumentPage, DocumentProcessingOptions } from '../types';

export async function parsePPTXDocument(
  buffer: ArrayBuffer,
  options: DocumentProcessingOptions
): Promise<{
  text: string;
  pages: DocumentPage[];
  nativeExtractMs: number;
  ocrMs: number;
}> {
  const nativeStart = Date.now();
  let ocrMs = 0;

  try {
    const uint8 = new Uint8Array(buffer);
    const files = unzipSync(uint8);

    const slidePaths = Object.keys(files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] ?? '0');
        const numB = parseInt(b.match(/\d+/)?.[0] ?? '0');
        return numA - numB;
      });

    if (slidePaths.length === 0) throw new Error('No slides found in PPTX archive');

    const pages: DocumentPage[] = [];
    const slideTexts: string[] = [];

    for (const [i, path] of slidePaths.entries()) {
      const slideNum = i + 1;
      const xml = new TextDecoder('utf-8').decode(files[path]);

      const text = xml
        .replace(/<\/a:t>/gi, ' ')
        .replace(/<\/a:p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const slideContent = `--- Slide ${slideNum} ---\n${text}`;
      slideTexts.push(slideContent);

      pages.push({
        pageNumber: slideNum,
        text: slideContent,
        headings: [`Slide ${slideNum}`],
        tables: [],
        figures: [],
        charts: [],
        codeBlocks: [],
      });
    }

    let fullText = slideTexts.join('\n\n');
    const nativeExtractMs = Date.now() - nativeStart;

    // Check for embedded images in ppt/media/
    const mediaFiles = Object.keys(files).filter((path) => /^ppt\/media\/image\d+\.(png|jpg|jpeg|webp)$/i.test(path));
    if (mediaFiles.length > 0 && options.openAIApiKey) {
      const ocrStart = Date.now();
      const ocrResults: string[] = [];

      for (const mediaPath of mediaFiles.slice(0, 5)) {
        const imageBytes = files[mediaPath];
        const ext = mediaPath.split('.').pop()?.toLowerCase() || 'png';
        const mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        const imageOcrText = await performVisionOCR(imageBytes.buffer, mime, options.openAIApiKey, options.ocrDetail);
        if (imageOcrText) {
          ocrResults.push(`[SLIDE_IMAGE_OCR: ${mediaPath}]\n${imageOcrText}`);
        }
      }

      ocrMs = Date.now() - ocrStart;
      if (ocrResults.length > 0) {
        fullText += '\n\n' + ocrResults.join('\n\n');
      }
    }

    return {
      text: fullText,
      pages,
      nativeExtractMs,
      ocrMs,
    };
  } catch (err) {
    throw new Error(`PPTX Parser failed: ${(err as Error).message}`);
  }
}
