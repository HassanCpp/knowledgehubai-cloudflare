// ─── Markdown Processor — pure JS ─────────────────────────────────────────────

export function parseMarkdown(buffer: ArrayBuffer): string {
  const text = new TextDecoder('utf-8').decode(buffer);
  // Strip markdown syntax minimally — keep content readable
  return text
    .replace(/^#{1,6}\s+/gm, '')     // headers
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')    // italic
    .replace(/`{3}[\s\S]*?`{3}/g, '')   // code blocks
    .replace(/`([^`]+)`/g, '$1')        // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // images
    .replace(/^[-*+]\s+/gm, '• ')      // bullets
    .replace(/^\d+\.\s+/gm, '')         // ordered lists
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
