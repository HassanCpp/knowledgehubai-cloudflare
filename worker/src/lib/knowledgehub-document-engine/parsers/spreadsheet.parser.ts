// ─── knowledgehub-document-engine: Spreadsheet Parser (XLSX, CSV) ─────────────

import type { DocumentPage, ExtractedTable } from '../types';

export function parseCSVDocument(buffer: ArrayBuffer): {
  text: string;
  pages: DocumentPage[];
  tables: ExtractedTable[];
} {
  const textRaw = new TextDecoder('utf-8').decode(buffer);
  const lines = textRaw.split('\n').filter((l) => l.trim().length > 0);

  const rows: string[][] = lines.map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
  const headers = rows[0] || [];
  const bodyRows = rows.slice(1);

  const markdownTable = buildMarkdownTable(headers, bodyRows);
  const text = `### CSV Data Table\n\n${markdownTable}`;

  const table: ExtractedTable = {
    tableId: 'table_csv_1',
    pageNumber: 1,
    headers,
    rows: bodyRows,
    markdownText: markdownTable,
    isReconstructed: false,
  };

  const pages: DocumentPage[] = [
    {
      pageNumber: 1,
      text,
      headings: ['CSV Data Table'],
      tables: [table],
      figures: [],
      charts: [],
      codeBlocks: [],
    },
  ];

  return { text, pages, tables: [table] };
}

export function parseExcelDocument(buffer: ArrayBuffer): {
  text: string;
  pages: DocumentPage[];
  tables: ExtractedTable[];
} {
  // Simple XML string decoding fallback for XLSX sheet streams
  const textRaw = new TextDecoder('utf-8').decode(buffer);
  const text = textRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const table: ExtractedTable = {
    tableId: 'table_excel_1',
    pageNumber: 1,
    headers: ['Data'],
    rows: [[text.slice(0, 500)]],
    markdownText: `| Content |\n| --- |\n| ${text.slice(0, 500)} |`,
    isReconstructed: true,
  };

  const pages: DocumentPage[] = [
    {
      pageNumber: 1,
      text: `### Spreadsheet Data\n\n${text}`,
      headings: ['Spreadsheet Data'],
      tables: [table],
      figures: [],
      charts: [],
      codeBlocks: [],
    },
  ];

  return { text, pages, tables: [table] };
}

function buildMarkdownTable(headers: string[], rows: string[][]): string {
  if (headers.length === 0) return '';
  const headerRow = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return `${headerRow}\n${separator}\n${body}`;
}
