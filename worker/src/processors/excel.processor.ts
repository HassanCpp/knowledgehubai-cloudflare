// ─── Excel Processor — SheetJS browser/ESM build ─────────────────────────────
// Converts each row into a plain-English sentence for embedding.

import { read, utils } from 'xlsx';

export function parseExcel(buffer: ArrayBuffer): string {
  try {
    const workbook = read(new Uint8Array(buffer), { type: 'array' });
    const parts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      parts.push(`## Sheet: ${sheetName}`);

      for (const row of rows) {
        const sentence = Object.entries(row)
          .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
          .map(([k, v]) => `${k} is ${v}`)
          .join(', ');
        if (sentence) parts.push(sentence + '.');
      }
    }

    return parts.join('\n').trim();
  } catch (err) {
    throw new Error(`Excel parsing failed: ${(err as Error).message}`);
  }
}
