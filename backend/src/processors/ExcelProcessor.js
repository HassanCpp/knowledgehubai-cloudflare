const XLSX = require('xlsx');
const BaseProcessor = require('./BaseProcessor');

class ExcelProcessor extends BaseProcessor {
  /**
   * Extracts text from an Excel file buffer, converting all sheets and rows into natural language.
   * @param {Buffer} fileBuffer 
   * @param {string} originalName 
   * @returns {Promise<Object>} Extracted document content
   */
  async extract(fileBuffer, originalName) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const compiledSheetsText = [];
      const sheetMetaData = [];

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        // Parse as a 2D array of rows
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length === 0) continue;

        const headers = rows[0].map((h) => (h ? h.toString().trim() : ''));
        const sheetParagraphs = [];

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;

          const sentenceParts = [];
          for (let c = 0; c < headers.length; c++) {
            const header = headers[c] || `Column ${c + 1}`;
            const val = row[c] !== undefined ? row[c].toString().trim() : 'N/A';
            sentenceParts.push(`the ${header} is "${val}"`);
          }

          sheetParagraphs.push(`Sheet [${sheetName}], Row ${r}: In this record, ${sentenceParts.join(', ')}.`);
        }

        compiledSheetsText.push(sheetParagraphs.join('\n'));
        sheetMetaData.push({
          sheetName,
          rowCount: rows.length,
          columnCount: headers.length,
        });
      }

      const finalText = compiledSheetsText.join('\n\n');

      return {
        text: finalText,
        pageCount: workbook.SheetNames.length,
        metadata: {
          originalName,
          sheets: sheetMetaData,
        },
      };
    } catch (error) {
      console.error('ExcelProcessor Extraction Error:', error.message);
      throw new Error(`Failed to extract text from Excel spreadsheet: ${error.message}`);
    }
  }
}

module.exports = ExcelProcessor;
