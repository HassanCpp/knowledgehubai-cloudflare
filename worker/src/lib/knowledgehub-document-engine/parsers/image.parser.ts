// ─── knowledgehub-document-engine: Image Parser (PNG, JPG, WEBP, GIF, TIFF, BMP) ───

import { preprocessImageBuffer } from '../services/image-preprocessor';
import { performVisionOCR } from '../services/ocr.service';
import type { DocumentPage, DocumentProcessingOptions, ExtractedFigure, ExtractedChart, ExtractedTable } from '../types';

export async function parseImageDocument(
  buffer: ArrayBuffer,
  mimeType: string,
  options: DocumentProcessingOptions
): Promise<{
  text: string;
  pages: DocumentPage[];
  figures: ExtractedFigure[];
  charts: ExtractedChart[];
  tables: ExtractedTable[];
  ocrMs: number;
  warnings: string[];
}> {
  const ocrStart = Date.now();
  const { processedBuffer, warnings } = preprocessImageBuffer(buffer, mimeType);

  const ocrText = await performVisionOCR(processedBuffer, mimeType, options.openAIApiKey, options.ocrDetail ?? 'high');
  const ocrMs = Date.now() - ocrStart;

  const figures: ExtractedFigure[] = [];
  const charts: ExtractedChart[] = [];
  const tables: ExtractedTable[] = [];

  // Parse [FIGURE: ...] tags from OCR text
  const figureRegex = /\[FIGURE:\s*(.*?)\|\s*(.*?)\|\s*(.*?)\]/gi;
  let fMatch;
  let figCounter = 1;
  while ((fMatch = figureRegex.exec(ocrText)) !== null) {
    figures.push({
      figureId: `fig_${figCounter++}`,
      pageNumber: 1,
      title: fMatch[1].trim(),
      caption: fMatch[2].trim(),
      description: fMatch[3].trim(),
    });
  }

  // Parse [CHART: ...] tags from OCR text
  const chartRegex = /\[CHART:\s*(.*?)\|\s*Axes:\s*(.*?)\|\s*(.*?)\|\s*(.*?)\|\s*(.*?)\]/gi;
  let cMatch;
  let chartCounter = 1;
  while ((cMatch = chartRegex.exec(ocrText)) !== null) {
    charts.push({
      chartId: `chart_${chartCounter++}`,
      pageNumber: 1,
      chartType: cMatch[1].trim(),
      axes: { x: cMatch[2].trim() },
      legend: [cMatch[3].trim()],
      values: [cMatch[4].trim()],
      trendSummary: cMatch[5].trim(),
    });
  }

  const pages: DocumentPage[] = [
    {
      pageNumber: 1,
      text: ocrText,
      headings: [],
      tables,
      figures,
      charts,
      codeBlocks: [],
    },
  ];

  return {
    text: ocrText,
    pages,
    figures,
    charts,
    tables,
    ocrMs,
    warnings,
  };
}
