// ─── PPTX Processor — raw XML unzip via fflate ────────────────────────────────
// PPTX is a ZIP of XML files. Slides live in ppt/slides/slide{N}.xml

import { unzipSync } from 'fflate';

export function parsePPTX(buffer: ArrayBuffer): string {
  try {
    const uint8 = new Uint8Array(buffer);
    const files = unzipSync(uint8);

    // Collect slide paths, sorted numerically
    const slidePaths = Object.keys(files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] ?? '0');
        const numB = parseInt(b.match(/\d+/)?.[0] ?? '0');
        return numA - numB;
      });

    if (slidePaths.length === 0) throw new Error('No slides found in PPTX');

    const slideTexts: string[] = [];

    for (const [i, path] of slidePaths.entries()) {
      const xml = new TextDecoder('utf-8').decode(files[path]);

      const text = xml
        .replace(/<\/a:t>/gi, ' ')    // text run ends → space
        .replace(/<\/a:p>/gi, '\n')   // paragraph ends → newline
        .replace(/<[^>]+>/g, '')      // strip all tags
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (text) slideTexts.push(`--- Slide ${i + 1} ---\n${text}`);
    }

    return slideTexts.join('\n\n').trim();
  } catch (err) {
    throw new Error(`PPTX parsing failed: ${(err as Error).message}`);
  }
}
