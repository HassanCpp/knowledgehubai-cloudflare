const BaseProcessor = require('./BaseProcessor');

class CSVProcessor extends BaseProcessor {
  /**
   * Extracts text from a CSV file, converting tabular rows into natural language sentences.
   * @param {Buffer} fileBuffer 
   * @param {string} originalName 
   * @returns {Promise<Object>} Extracted document content
   */
  async extract(fileBuffer, originalName) {
    const rawText = fileBuffer.toString('utf-8');
    const lines = rawText.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (lines.length === 0) {
      return { text: '', pageCount: 1, metadata: { originalName } };
    }

    // Parse CSV rows respecting quotes
    const rows = lines.map((line) => {
      // Basic CSV splitter that respects commas inside quotes
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    });

    const headers = rows[0];
    const naturalLanguageParagraphs = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      // Skip empty or short rows
      if (row.length === 0 || (row.length === 1 && !row[0])) continue;

      const sentenceParts = [];
      for (let c = 0; c < headers.length; c++) {
        const header = headers[c] || `Column ${c + 1}`;
        const val = row[c] !== undefined ? row[c] : 'N/A';
        sentenceParts.push(`the ${header} is "${val}"`);
      }

      naturalLanguageParagraphs.push(`Row ${r}: In this record, ${sentenceParts.join(', ')}.`);
    }

    const compiledText = naturalLanguageParagraphs.join('\n');

    return {
      text: compiledText,
      pageCount: 1,
      metadata: {
        originalName,
        rowCount: rows.length,
        columnCount: headers.length,
        headers,
      },
    };
  }
}

module.exports = CSVProcessor;
