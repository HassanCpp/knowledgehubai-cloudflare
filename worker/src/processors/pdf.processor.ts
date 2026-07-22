// ─── PDF Processor — uses unpdf (WASM PDF.js port) ───────────────────────────

import { getDocumentProxy, extractText } from 'unpdf';

export async function parsePDF(buffer: ArrayBuffer): Promise<string> {
  try {
    const uint8 = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8);
    const { text } = await extractText(pdf, { mergePages: true });
    return text.replace(/\n{3,}/g, '\n\n').trim();
  } catch (err) {
    throw new Error(`PDF parsing failed: ${(err as Error).message}`);
  }
}
