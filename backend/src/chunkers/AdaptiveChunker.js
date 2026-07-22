/**
 * Adaptive Chunker that creates hierarchical parent-child chunks (small, medium, large).
 * Uses classification to dynamically adjust boundaries.
 */
class AdaptiveChunker {
  /**
   * Chunks extracted document text based on its classification.
   * @param {string} rawText Complete text of the document
   * @param {string} classification 'Invoice', 'Research Paper', 'Book', 'Manual', 'FAQ', 'Contract', 'Presentation', 'Policy', 'Resume', 'Spreadsheet', 'Product Catalog', 'Generic'
   * @returns {Array<Object>} Array of raw chunks { text, index, page, section, heading, type, rawParentIndex }
   */
  chunk(rawText, classification) {
    if (!rawText || rawText.trim().length === 0) return [];

    let largeChunks = [];

    // 1. Generate Large Chunks based on classification
    switch (classification) {
      case 'FAQ':
        largeChunks = this.splitFAQ(rawText);
        break;
      case 'Invoice':
        largeChunks = this.splitInvoice(rawText);
        break;
      case 'Research Paper':
        largeChunks = this.splitResearchPaper(rawText);
        break;
      case 'Contract':
        largeChunks = this.splitContract(rawText);
        break;
      case 'Spreadsheet':
        largeChunks = this.splitSpreadsheet(rawText);
        break;
      case 'Presentation':
        largeChunks = this.splitPresentation(rawText);
        break;
      case 'Code-Blocks':
        largeChunks = this.splitCodeBlocks(rawText);
        break;
      default:
        largeChunks = this.splitSemantic(rawText, 1200); // Max 1200 characters for large
        break;
    }

    // Ensure we have at least one large chunk if splitting returned empty
    if (largeChunks.length === 0) {
      largeChunks = [{ text: rawText, section: 'Main', heading: 'Document', page: 1 }];
    }

    const allChunks = [];
    let currentIndex = 0;

    // 2. For each Large Chunk, create Medium and Small child chunks
    largeChunks.forEach((large, largeIdx) => {
      // Push Large Chunk first
      const largeChunkIdx = currentIndex++;
      allChunks.push({
        text: large.text,
        index: largeChunkIdx,
        page: large.page || 1,
        section: large.section || '',
        heading: large.heading || '',
        type: 'large',
        rawParentIndex: null, // Large chunk has no parent
      });

      // Generate Medium Chunks (approx. 400 chars) from the Large chunk text
      const mediums = this.subSplit(large.text, 400, 100);
      mediums.forEach((medText) => {
        const medChunkIdx = currentIndex++;
        allChunks.push({
          text: medText,
          index: medChunkIdx,
          page: large.page || 1,
          section: large.section || '',
          heading: large.heading || '',
          type: 'medium',
          rawParentIndex: largeChunkIdx, // Parent is the Large chunk
        });

        // Generate Small Chunks (approx. 120 chars) from the Medium chunk text
        const smalls = this.subSplit(medText, 120, 30);
        smalls.forEach((smallText) => {
          allChunks.push({
            text: smallText,
            index: currentIndex++,
            page: large.page || 1,
            section: large.section || '',
            heading: large.heading || '',
            type: 'small',
            rawParentIndex: medChunkIdx, // Parent is the Medium chunk
          });
        });
      });
    });

    return allChunks;
  }

  /**
   * Split FAQ text into Question + Answer pairs
   */
  splitFAQ(text) {
    const chunks = [];
    // Match Q: ... A: ... or Question: ... Answer: ...
    const faqPattern = /(?:Q:|Question:)\s*([\s\S]*?)(?=(?:Q:|Question:|$))/gi;
    let match;
    let index = 0;

    while ((match = faqPattern.exec(text)) !== null) {
      const qAndA = match[0].trim();
      if (qAndA.length > 10) {
        // Find dividing point between Q and A to locate heading
        const aSplit = qAndA.search(/(?:A:|Answer:)/i);
        const questionText = aSplit !== -1 ? qAndA.substring(0, aSplit).trim() : 'FAQ Question';

        chunks.push({
          text: qAndA,
          heading: questionText.substring(0, 100),
          section: `FAQ #${++index}`,
          page: 1,
        });
      }
    }

    if (chunks.length === 0) {
      // Fallback if FAQ pattern doesn't match
      return this.splitSemantic(text, 1000);
    }
    return chunks;
  }

  /**
   * Split Invoice text (already formatted as structured text or JSON)
   */
  splitInvoice(text) {
    // Invoices are usually processed as a single entity, or split by line items
    // If it looks like JSON, we try to preserve it
    const chunks = [];
    try {
      // Check if it's valid JSON
      JSON.parse(text);
      chunks.push({
        text,
        heading: 'Invoice Details',
        section: 'Invoice Summary',
        page: 1,
      });
    } catch {
      // If text, chunk by line-items or preserve as one large block if small
      if (text.length < 2000) {
        chunks.push({
          text,
          heading: 'Invoice Details',
          section: 'Invoice',
          page: 1,
        });
      } else {
        return this.splitSemantic(text, 1000);
      }
    }
    return chunks;
  }

  /**
   * Split Research Paper text by sections (Abstract, Methods, Results, etc.)
   */
  splitResearchPaper(text) {
    const chunks = [];
    // Typical headings: Abstract, Introduction, Methods, Results, Discussion, Conclusion, References
    const headingPattern = /^(Abstract|Introduction|Methods|Methodology|Results|Discussion|Conclusion|References)\b/im;
    
    const lines = text.split('\n');
    let currentSection = 'Abstract';
    let currentHeading = 'Title';
    let currentText = '';
    let pageNum = 1;

    for (const line of lines) {
      // Track page indicators if present (e.g. "[Page 3]" or "Page 3")
      const pageMatch = line.match(/(?:\[Page\s*(\d+)\]|^Page\s*(\d+)$)/i);
      if (pageMatch) {
        pageNum = parseInt(pageMatch[1] || pageMatch[2]);
        continue;
      }

      const match = line.trim().match(headingPattern);
      if (match) {
        if (currentText.trim().length > 100) {
          chunks.push({
            text: currentText.trim(),
            section: currentSection,
            heading: currentHeading,
            page: pageNum,
          });
        }
        currentSection = match[1];
        currentHeading = line.trim();
        currentText = line + '\n';
      } else {
        currentText += line + '\n';
      }
    }

    if (currentText.trim().length > 0) {
      chunks.push({
        text: currentText.trim(),
        section: currentSection,
        heading: currentHeading,
        page: pageNum,
      });
    }

    // Sub-split chunks if any section text is too large
    const finalChunks = [];
    chunks.forEach((c) => {
      if (c.text.length > 2000) {
        const subSecs = this.splitSemantic(c.text, 1200);
        subSecs.forEach((sub, subIdx) => {
          finalChunks.push({
            text: sub.text,
            section: c.section,
            heading: `${c.heading} - Part ${subIdx + 1}`,
            page: c.page,
          });
        });
      } else {
        finalChunks.push(c);
      }
    });

    return finalChunks;
  }

  /**
   * Split Contract text into clause-aware structures
   */
  splitContract(text) {
    const chunks = [];
    // Look for patterns like "Section 1.", "Article 2.", "Clause 3." or "1.1 " at the beginning of a line
    const clausePattern = /^(?:Section|Article|Clause|\d+\.\d+)\b/im;

    const lines = text.split('\n');
    let currentHeading = 'Preamble';
    let currentText = '';
    let pageNum = 1;

    for (const line of lines) {
      const match = line.trim().match(clausePattern);
      if (match) {
        if (currentText.trim().length > 100) {
          chunks.push({
            text: currentText.trim(),
            section: 'Contract Clause',
            heading: currentHeading,
            page: pageNum,
          });
        }
        currentHeading = line.trim().substring(0, 100);
        currentText = line + '\n';
      } else {
        currentText += line + '\n';
      }
    }

    if (currentText.trim().length > 0) {
      chunks.push({
        text: currentText.trim(),
        section: 'Contract Clause',
        heading: currentHeading,
        page: pageNum,
      });
    }

    return chunks;
  }

  /**
   * Split spreadsheet data
   */
  splitSpreadsheet(text) {
    // Spreadsheet rows are converted into paragraphs, so we split by row segments (approx 5 rows per chunk)
    const chunks = [];
    const lines = text.split('\n');
    let currentText = '';
    let rowCount = 0;

    for (const line of lines) {
      if (line.trim().length > 0) {
        currentText += line + '\n';
        rowCount++;
        if (rowCount >= 8) {
          chunks.push({
            text: currentText.trim(),
            section: 'Data Sheet',
            heading: 'Row Group',
            page: 1,
          });
          currentText = '';
          rowCount = 0;
        }
      }
    }

    if (currentText.trim().length > 0) {
      chunks.push({
        text: currentText.trim(),
        section: 'Data Sheet',
        heading: 'Row Group',
        page: 1,
      });
    }

    return chunks;
  }

  /**
   * Split generic text semantically based on sentence punctuation
   */
  splitSemantic(text, maxChars) {
    const chunks = [];
    // Split by sentence boundaries, preserving punctuation
    const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [text];
    
    let currentText = '';
    let pageNum = 1;

    for (const sentence of sentences) {
      // Check for page tag
      const pageMatch = sentence.match(/\[Page\s*(\d+)\]/i);
      if (pageMatch) {
        pageNum = parseInt(pageMatch[1]);
      }

      if ((currentText + sentence).length > maxChars) {
        if (currentText.trim().length > 0) {
          chunks.push({
            text: currentText.trim(),
            section: 'General',
            heading: 'Paragraph',
            page: pageNum,
          });
        }
        currentText = sentence;
      } else {
        currentText += sentence;
      }
    }

    if (currentText.trim().length > 0) {
      chunks.push({
        text: currentText.trim(),
        section: 'General',
        heading: 'Paragraph',
        page: pageNum,
      });
    }

    return chunks;
  }

  /**
   * Simple sliding window sub-splitter for creating children (Medium and Small chunks)
   */
  subSplit(text, chunkSize, overlap) {
    const words = text.split(/\s+/);
    const subChunks = [];
    let currentWords = [];
    let currentLength = 0;

    for (const word of words) {
      currentWords.push(word);
      currentLength += word.length + 1; // +1 for space

      if (currentLength >= chunkSize) {
        subChunks.push(currentWords.join(' '));
        // Sliding window overlap: keep last N words
        const overlapWordsCount = Math.floor(overlap / 6); // estimate 6 chars per word
        currentWords = currentWords.slice(-overlapWordsCount || -1);
        currentLength = currentWords.join(' ').length;
      }
    }

    // Add trailing segment if non-empty and hasn't been added
    if (currentWords.length > 0 && subChunks.indexOf(currentWords.join(' ')) === -1) {
      subChunks.push(currentWords.join(' '));
    }

    return subChunks.filter((s) => s.trim().length > 5);
  }

  /**
   * Split slide deck presentations slide-by-slide
   */
  splitPresentation(text) {
    const chunks = [];
    // Split by slide boundaries or slide markers (e.g. "Slide 1" or "--- Slide 2 ---")
    const slideMarkers = /(?:^|\n)(?:slide\s*\d+|\-\-\-\s*slide\s*\d+\s*\-\-\-)/gi;
    const slides = text.split(slideMarkers);
    let slideIndex = 1;

    for (const slide of slides) {
      const slideText = slide.trim();
      if (slideText.length > 20) {
        // Use first line of slide text as the heading
        const lines = slideText.split('\n');
        const heading = lines[0].trim().substring(0, 80) || `Slide #${slideIndex}`;
        chunks.push({
          text: slideText,
          section: 'Slide Deck',
          heading: heading,
          page: slideIndex++,
        });
      }
    }

    if (chunks.length === 0) {
      return this.splitSemantic(text, 1000);
    }
    return chunks;
  }

  /**
   * Split code documents, keeping programming implementations whole
   */
  splitCodeBlocks(text) {
    const chunks = [];
    // Regex matching markdown fenced code blocks (```js ... ```)
    const codeBlockPattern = /```(?:[a-zA-Z0-9+#-]+)?\n([\s\S]*?)\n```/g;
    let lastIndex = 0;
    let match;
    let blockIndex = 1;

    while ((match = codeBlockPattern.exec(text)) !== null) {
      // 1. Extract markdown/documentation text before the code block
      const prevText = text.substring(lastIndex, match.index).trim();
      if (prevText.length > 50) {
        const semanticParagraphs = this.splitSemantic(prevText, 1000);
        chunks.push(...semanticParagraphs);
      }

      // 2. Keep the code block completely whole to preserve syntax
      const codeText = match[0].trim();
      chunks.push({
        text: codeText,
        section: 'Code Implementation',
        heading: `Code Block #${blockIndex++}`,
        page: 1,
      });

      lastIndex = codeBlockPattern.lastIndex;
    }

    // 3. Extract remaining text after the final code block
    const remaining = text.substring(lastIndex).trim();
    if (remaining.length > 50) {
      const semanticParagraphs = this.splitSemantic(remaining, 1000);
      chunks.push(...semanticParagraphs);
    }

    if (chunks.length === 0) {
      chunks.push({
        text,
        section: 'Source Code',
        heading: 'Source file',
        page: 1,
      });
    }

    return chunks;
  }
}

module.exports = new AdaptiveChunker();
