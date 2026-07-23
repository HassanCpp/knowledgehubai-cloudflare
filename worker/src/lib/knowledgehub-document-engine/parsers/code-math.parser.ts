// ─── knowledgehub-document-engine: Code & Math Parser ───────────────────────

import type { ExtractedCodeBlock } from '../types';

export function extractCodeAndMathBlocks(
  text: string
): { cleanedText: string; codeBlocks: ExtractedCodeBlock[] } {
  const codeBlocks: ExtractedCodeBlock[] = [];
  let blockCounter = 1;

  // Regex to match markdown code fences ```lang ... ```
  const codeFenceRegex = /```([a-zA-Z0-9_\-+]*)\n([\s\S]*?)```/g;

  const cleanedText = text.replace(codeFenceRegex, (match, lang, codeContent) => {
    const inferredLang = inferLanguage(lang, codeContent);
    const codeId = `code_${blockCounter++}`;

    codeBlocks.push({
      codeId,
      pageNumber: 1,
      language: inferredLang,
      code: codeContent, // Preserved exact tabs, spaces, newlines
      indentationPreserved: true,
    });

    return `\n\n[CODE_BLOCK: ${codeId} | Language: ${inferredLang}]\n\`\`\`${inferredLang}\n${codeContent}\n\`\`\`\n\n`;
  });

  return { cleanedText, codeBlocks };
}

function inferLanguage(hintLang: string, code: string): string {
  if (hintLang && hintLang.trim().length > 0) {
    return hintLang.trim().toLowerCase();
  }

  // Simple heuristic language detection
  if (code.includes('import React') || code.includes('export default') || code.includes('const ') || code.includes('let ')) return 'typescript';
  if (code.includes('def ') || code.includes('import ') && code.includes(':\n')) return 'python';
  if (code.includes('SELECT ') || code.includes('FROM ') || code.includes('WHERE ')) return 'sql';
  if (code.includes('<html') || code.includes('<div') || code.includes('</')) return 'html';
  if (code.includes('fn main()') || code.includes('let mut ')) return 'rust';
  if (code.includes('package main') || code.includes('func ')) return 'go';
  if (code.includes('#include <') || code.includes('int main(')) return 'cpp';

  return 'text';
}
