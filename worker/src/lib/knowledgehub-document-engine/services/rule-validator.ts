// ─── knowledgehub-document-engine: Rule Validator Service ───────────────────

import type { StructuredDocument, RuleValidationReport } from '../types';

export function validateStructuredDocument(
  doc: StructuredDocument,
  retryAttempted: boolean = false
): RuleValidationReport {
  const warnings: string[] = [];
  const errors: string[] = [];

  const checks = {
    emptyText: false,
    missingTitle: false,
    duplicatePages: false,
    duplicateParagraphs: false,
    tableSyntaxValid: true,
    statisticsValid: true,
  };

  // 1. Empty text check
  if (!doc.text || doc.text.trim().length < 10) {
    checks.emptyText = true;
    errors.push('Extraction returned empty or insufficient text (< 10 characters).');
  }

  // 2. Missing title check
  if (!doc.metadata.title || doc.metadata.title.trim() === '') {
    checks.missingTitle = true;
    warnings.push('Document title is missing or could not be determined.');
  }

  // 3. Duplicate pages check
  const pageNumbers = doc.pages.map((p) => p.pageNumber);
  const uniquePageNumbers = new Set(pageNumbers);
  if (pageNumbers.length !== uniquePageNumbers.size) {
    checks.duplicatePages = true;
    warnings.push('Duplicate page numbers detected in document structure.');
  }

  // 4. Duplicate paragraphs check (>3 identical paragraphs)
  const paragraphs = doc.text.split('\n\n').filter((p) => p.trim().length > 30);
  const pMap = new Map<string, number>();
  let hasExcessDuplicates = false;
  for (const p of paragraphs) {
    const norm = p.trim().toLowerCase();
    const count = (pMap.get(norm) ?? 0) + 1;
    pMap.set(norm, count);
    if (count >= 3) {
      hasExcessDuplicates = true;
    }
  }
  if (hasExcessDuplicates) {
    checks.duplicateParagraphs = true;
    warnings.push('High paragraph duplication detected across document pages.');
  }

  // 5. Table syntax integrity check
  for (const table of doc.tables) {
    if (!table.markdownText.includes('|')) {
      checks.tableSyntaxValid = false;
      warnings.push(`Table ${table.tableId} missing markdown column pipes (|).`);
    }
  }

  // 6. Statistics check
  if (doc.statistics.totalCharacters !== doc.text.length) {
    checks.statisticsValid = false;
    warnings.push('Document character statistics discrepancy detected.');
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    retryAttempted,
    warnings,
    errors,
    checks,
  };
}
