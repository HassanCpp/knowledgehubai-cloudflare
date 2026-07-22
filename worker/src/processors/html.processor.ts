// ─── HTML Processor — pure regex text extraction ──────────────────────────────
// Used for uploaded HTML files. The crawler uses a richer parser (htmlparser2).

export function parseHTML(buffer: ArrayBuffer): string {
  const html = new TextDecoder('utf-8').decode(buffer);
  return extractTextFromHTML(html);
}

export function extractTextFromHTML(html: string): string {
  return html
    // Remove script, style, noscript blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Block-level elements → newlines
    .replace(/<\/?(p|div|section|article|main|header|footer|h[1-6]|li|dt|dd|tr|td|th|blockquote|pre)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    // Strip all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x[0-9A-Fa-f]+;/g, '')
    .replace(/&[a-z]+;/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
