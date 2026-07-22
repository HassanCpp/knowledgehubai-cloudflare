// ─── Plain Text Processor ─────────────────────────────────────────────────────

export function parseText(buffer: ArrayBuffer): string {
  const text = new TextDecoder('utf-8').decode(buffer);
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
