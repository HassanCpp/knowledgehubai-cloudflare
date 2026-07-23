// ─── knowledgehub-document-engine: Type Definitions ───────────────────────────

export type DocumentType =
  | 'pdf_searchable'
  | 'pdf_scanned'
  | 'pdf_hybrid'
  | 'docx'
  | 'doc'
  | 'pptx'
  | 'ppt'
  | 'excel'
  | 'csv'
  | 'image'
  | 'code'
  | 'markdown'
  | 'text'
  | 'unknown';

export type ValidationMode = 'code' | 'ai';

export interface DocumentProcessingOptions {
  openAIApiKey: string;
  validationMode?: ValidationMode;
  ocrDetail?: 'auto' | 'low' | 'high';
  maxFileSizeMB?: number;
  enableImagePreprocessing?: boolean;
}

export interface DocumentInput {
  filename: string;
  mimeType: string;
  options: DocumentProcessingOptions;
}

export interface DocumentPage {
  pageNumber: number;
  text: string;
  headings: string[];
  tables: ExtractedTable[];
  figures: ExtractedFigure[];
  charts: ExtractedChart[];
  codeBlocks: ExtractedCodeBlock[];
}

export interface ExtractedTable {
  tableId: string;
  pageNumber: number;
  headers: string[];
  rows: string[][];
  markdownText: string;
  isReconstructed: boolean;
}

export interface ExtractedFigure {
  figureId: string;
  pageNumber: number;
  title?: string;
  caption?: string;
  description: string;
}

export interface ExtractedChart {
  chartId: string;
  pageNumber: number;
  chartType: string;
  axes?: { x?: string; y?: string };
  legend?: string[];
  values?: string[];
  trendSummary: string;
}

export interface ExtractedCodeBlock {
  codeId: string;
  pageNumber: number;
  language?: string;
  code: string;
  indentationPreserved: boolean;
}

export interface RuleValidationReport {
  isValid: boolean;
  retryAttempted: boolean;
  warnings: string[];
  errors: string[];
  checks: {
    emptyText: boolean;
    missingTitle: boolean;
    duplicatePages: boolean;
    duplicateParagraphs: boolean;
    tableSyntaxValid: boolean;
    statisticsValid: boolean;
  };
}

export interface AIValidationReport {
  confidence: number;
  warnings: string[];
  recommendedCorrections: string[];
  semanticConsistencyScore: number;
}

export interface DocumentStatistics {
  totalWords: number;
  totalCharacters: number;
  totalPages: number;
  tableCount: number;
  figureCount: number;
  chartCount: number;
  codeBlockCount: number;
}

export interface ProcessingTimeBreakdown {
  totalMs: number;
  nativeExtractMs: number;
  ocrMs: number;
  ruleValidationMs: number;
  aiValidationMs: number;
}

export interface StructuredDocument {
  documentType: DocumentType;
  metadata: {
    filename: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    title?: string;
    author?: string;
    creationDate?: string;
    language?: string;
  };
  pages: DocumentPage[];
  text: string;
  tables: ExtractedTable[];
  figures: ExtractedFigure[];
  charts: ExtractedChart[];
  codeBlocks: ExtractedCodeBlock[];
  warnings: string[];
  validation: {
    ruleValidation: RuleValidationReport;
    aiValidation?: AIValidationReport;
  };
  statistics: DocumentStatistics;
  processingTime: ProcessingTimeBreakdown;
}
