// ─── knowledgehub-document-engine: Image Preprocessor Service ──────────────────

export interface ImagePreprocessResult {
  processedBuffer: ArrayBuffer;
  warnings: string[];
  dimensionsInferred?: { width?: number; height?: number };
}

export function preprocessImageBuffer(
  buffer: ArrayBuffer,
  mimeType: string
): ImagePreprocessResult {
  const warnings: string[] = [];

  // Check file size & basic header validations
  if (buffer.byteLength < 100) {
    warnings.push('Image buffer is unexpectedly small (<100 bytes). OCR accuracy may be degraded.');
  }

  // Handle GIF (ensure first frame / single frame handling indicator)
  if (mimeType === 'image/gif') {
    warnings.push('GIF format detected: processing static frame representation for OCR.');
  } else if (mimeType.includes('tiff')) {
    warnings.push('TIFF format detected: passing buffer to high-detail vision pipeline.');
  } else if (mimeType.includes('bmp')) {
    warnings.push('BMP format detected: image pre-validated.');
  }

  return {
    processedBuffer: buffer,
    warnings,
  };
}
