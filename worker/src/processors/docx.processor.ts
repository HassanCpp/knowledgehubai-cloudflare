// ─── DOCX Processor — raw XML unzip via fflate ────────────────────────────────
// DOCX is a ZIP file containing word/document.xml

import { unzipSync } from 'fflate';

export function parseDOCX(buffer: ArrayBuffer): string {
  try {
    const uint8 = new Uint8Array(buffer);
    const files = unzipSync(uint8);

    const docXmlBytes = files['word/document.xml'];
    if (!docXmlBytes) throw new Error('word/document.xml not found in DOCX archive');

    const xml = new TextDecoder('utf-8').decode(docXmlBytes);

    const text = xml
      .replace(/<w:br[^>]*\/>/gi, '\n')       // line breaks
      .replace(/<\/w:p>/gi, '\n')              // paragraph ends
      .replace(/<\/w:tc>/gi, '\t')             // table cell ends
      .replace(/<\/w:tr>/gi, '\n')             // table row ends
      .replace(/<[^>]+>/g, '')                 // strip all remaining tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&#x[0-9A-Fa-f]+;/g, '')       // strip XML hex entities
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return text;
  } catch (err) {
    throw new Error(`DOCX parsing failed: ${(err as Error).message}`);
  }
}
