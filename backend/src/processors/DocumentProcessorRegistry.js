const PDFProcessor = require('./PDFProcessor');
const ScannedPDFProcessor = require('./ScannedPDFProcessor');
const WordProcessor = require('./WordProcessor');
const TextProcessor = require('./TextProcessor');
const MarkdownProcessor = require('./MarkdownProcessor');
const CSVProcessor = require('./CSVProcessor');
const ExcelProcessor = require('./ExcelProcessor');
const ImageProcessor = require('./ImageProcessor');
const InvoiceProcessor = require('./InvoiceProcessor');
const PresentationProcessor = require('./PresentationProcessor');
const HTMLProcessor = require('./HTMLProcessor');
const GenericDocumentProcessor = require('./GenericDocumentProcessor');

class DocumentProcessorRegistry {
  /**
   * Retrieves the correct processor based on filename and type.
   * @param {string} filename 
   * @param {string} mimeType 
   * @param {boolean} isScanned Force scanned PDF processing
   * @returns {Object} BaseProcessor implementation instance
   */
  getProcessor(filename, mimeType, isScanned = false) {
    const ext = filename.split('.').pop().toLowerCase();

    if (isScanned && ext === 'pdf') {
      return new ScannedPDFProcessor();
    }

    switch (ext) {
      case 'pdf':
        return new PDFProcessor();
      case 'docx':
        return new WordProcessor();
      case 'txt':
        return new TextProcessor();
      case 'md':
        return new MarkdownProcessor();
      case 'csv':
        return new CSVProcessor();
      case 'xlsx':
      case 'xls':
        return new ExcelProcessor();
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
        // Check if it represents an invoice file based on name
        if (filename.toLowerCase().includes('invoice')) {
          return new InvoiceProcessor();
        }
        return new ImageProcessor();
      case 'pptx':
        return new PresentationProcessor();
      case 'html':
      case 'htm':
        return new HTMLProcessor();
      default:
        return new GenericDocumentProcessor(); // Standard fallback
    }
  }
}

module.exports = new DocumentProcessorRegistry();
