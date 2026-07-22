// ─── CSV Processor — pure JS, no dependencies ─────────────────────────────────

export function parseCSV(buffer: ArrayBuffer): string {
  const text = new TextDecoder('utf-8').decode(buffer);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';

  // Parse header
  const headers = splitCSVLine(lines[0]);
  const parts: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    const sentence = headers
      .map((h, idx) => {
        const v = values[idx]?.trim() ?? '';
        return v ? `${h.trim()} is ${v}` : null;
      })
      .filter(Boolean)
      .join(', ');
    if (sentence) parts.push(sentence + '.');
  }

  return parts.join('\n').trim();
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
