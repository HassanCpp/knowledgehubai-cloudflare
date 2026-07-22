const DocumentChunk = require('../models/DocumentChunk');
const openai = require('../config/openai');

class ContextService {
  /**
   * Translates small retrieved hits into their root parent text blocks.
   * @param {Array<Object>} matchedHits Small/Medium chunk hits from retriever
   * @returns {Promise<Array<Object>>} Parent-expanded hits
   */
  async expandCandidates(matchedHits) {
    if (!matchedHits || matchedHits.length === 0) return [];

    const chunkIdsToFetch = matchedHits.map((h) => h.mongodbChunkId);
    const initialChunks = await DocumentChunk.find({ _id: { $in: chunkIdsToFetch } });
    const chunkMap = new Map(initialChunks.map((c) => [c._id.toString(), c]));

    // Iteratively fetch all parent & grandparent chunks up to the root level
    let missingParentIds = initialChunks
      .map((c) => c.parentId)
      .filter((id) => id !== null && id !== undefined && !chunkMap.has(id.toString()));

    while (missingParentIds.length > 0) {
      const fetchedParents = await DocumentChunk.find({ _id: { $in: missingParentIds } });
      if (fetchedParents.length === 0) break;

      fetchedParents.forEach((p) => chunkMap.set(p._id.toString(), p));

      missingParentIds = fetchedParents
        .map((p) => p.parentId)
        .filter((id) => id !== null && id !== undefined && !chunkMap.has(id.toString()));
    }

    // Resolve texts (walk up parent hierarchy to the root Large Parent chunk)
    return matchedHits.map((hit) => {
      const docId = hit.mongodbChunkId.toString();
      let current = chunkMap.get(docId);
      
      let resolvedText = hit.text;
      let usedParent = false;
      let topChunk = current;

      // Walk up parentId hierarchy to reach the root parent chunk
      while (current && current.parentId) {
        const parentChunk = chunkMap.get(current.parentId.toString());
        if (parentChunk) {
          current = parentChunk;
          topChunk = parentChunk;
          usedParent = true;

          // If parent chunk is short (<= 4000 chars), use full parent text
          if (parentChunk.text.length <= 4000) {
            resolvedText = parentChunk.text;
          } else {
            // If parent chunk is large (> 4000 chars), extract a 4000-char window centered around hit.text
            const cleanParent = parentChunk.text.replace(/\r?\n|\r/g, ' ');
            const cleanHit = hit.text ? hit.text.replace(/\r?\n|\r/g, ' ').trim() : '';
            // Specifically match 624.xxx section codes or standard section patterns
            const sectionMatch = cleanHit.match(/\b624\.\d{3,4}\b/) || cleanHit.match(/\b\d{3}\.\d{3,5}\b/);
            
            let pos = -1;
            if (sectionMatch) {
              const code = sectionMatch[0];
              // 1. Try matching exact section header pattern (e.g. "NAC 624.786")
              pos = cleanParent.indexOf(`NAC ${code}`);
              // 2. If not found, try "624.xxx " with trailing space (heading start)
              if (pos === -1) {
                pos = cleanParent.indexOf(`${code} `);
              }
              // 3. Fallback to lastIndexOf (section body is listed after TOC)
              if (pos === -1) {
                pos = cleanParent.lastIndexOf(code);
              }
            }

            if (pos === -1 && cleanHit.length > 0) {
              const targetSnippet = cleanHit.substring(0, 30);
              pos = cleanParent.indexOf(targetSnippet);
            }

            if (pos !== -1) {
              const start = Math.max(0, pos - 1000);
              const end = Math.min(cleanParent.length, pos + cleanHit.length + 2000);
              const parentWindow = cleanParent.substring(start, end);
              resolvedText = `${hit.text}\n\n[Full Section Context]:\n${parentWindow}`;
            } else {
              // Fallback to hit.text itself if parent position is not located
              resolvedText = hit.text;
            }
            break;
          }
        } else {
          break;
        }
      }

      return {
        ...hit,
        text: resolvedText,
        usedParent,
        page: topChunk ? topChunk.page : hit.page,
        heading: topChunk ? topChunk.heading : hit.heading,
        section: topChunk ? topChunk.section : hit.section,
      };
    });
  }

  /**
   * Translates small retrieved chunks into their parent text blocks,
   * de-duplicates overlaps, and organizes a hierarchical context.
   * @param {Array<Object>} matchedHits Small/Medium chunk hits from ranker or retriever
   * @param {number} charBudget Max characters for LLM prompt context (default: 16000 ~4000 tokens)
   */
  async buildContext(matchedHits, charBudget = 16000) {
    if (!matchedHits || matchedHits.length === 0) {
      return { contextText: 'No document context found.', sources: [] };
    }

    // 1. Expand hits to parent text blocks if not already expanded
    const resolvedHits = matchedHits[0]?.usedParent !== undefined
      ? matchedHits
      : await this.expandCandidates(matchedHits);

    // 2. De-duplicate: If multiple retrieved chunks resolved to the same parent text block, keep only one
    const uniqueHitsMap = new Map();
    resolvedHits.forEach((hit) => {
      // Use text hash or text content as key to deduplicate identical parent texts
      const key = hit.text.trim();
      if (!uniqueHitsMap.has(key)) {
        uniqueHitsMap.set(key, hit);
      }
    });

    const uniqueHits = Array.from(uniqueHitsMap.values());

    // 3. Assemble context text respecting budget
    let contextText = '';
    const sources = [];
    let currentLength = 0;

    for (const hit of uniqueHits) {
      const chunkBlock = `\n---
Document: ${hit.filename}
Classification: ${hit.classification || 'Generic'}
Location: Page ${hit.page || 1}${hit.section ? `, Section: ${hit.section}` : ''}${hit.heading ? `, Heading: ${hit.heading}` : ''}
Content:
${hit.text}
`;

      if (currentLength + chunkBlock.length > charBudget) {
        // If we haven't added any sources yet and this chunk is large, slice it to fit instead of dropping it!
        if (sources.length === 0) {
          const remainingSpace = Math.max(1000, charBudget - currentLength - 300);
          const slicedText = hit.text.substring(0, remainingSpace);
          const slicedBlock = `\n---
Document: ${hit.filename}
Classification: ${hit.classification || 'Generic'}
Location: Page ${hit.page || 1}
Content:
${slicedText}
`;
          contextText += slicedBlock;
          sources.push({
            chunkId: hit.chunkId,
            documentId: hit.documentId,
            filename: hit.filename,
            page: hit.page,
            section: hit.section,
            heading: hit.heading,
            similarity: hit.finalScore || hit.score,
          });
        }
        break; // Stop adding further chunks
      }

      contextText += chunkBlock;
      currentLength += chunkBlock.length;
      sources.push({
        chunkId: hit.chunkId,
        documentId: hit.documentId,
        filename: hit.filename,
        page: hit.page,
        section: hit.section,
        heading: hit.heading,
        similarity: hit.finalScore || hit.score,
      });
    }

    return {
      contextText,
      sources,
    };
  }

  /**
   * Reflects on whether the retrieved context contains the facts required to answer the query.
   * @param {string} query The rewritten question
   * @param {string} context Text context
   * @returns {Promise<boolean>} True if context is sufficient, False otherwise
   */
  async reflectOnContext(query, context) {
    if (!context || context.trim() === 'No document context found.') {
      return false;
    }

    const prompt = `You are a fact-checking and retrieval quality assistant.
Evaluate whether the following retrieved Context contains enough direct information to fully answer the Query.

Query: "${query}"

Context:
"""
${context}
"""

Determine if the context is sufficient. Respond with exactly one word:
"YES" if the context contains the answer details.
"NO" if the context does not contain the information needed to answer the query.

Do not output any explanation. Only output "YES" or "NO".`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 5,
      });

      const ans = response.choices[0].message.content.trim().toUpperCase();
      console.log(`Self-Reflection check results: ${ans}`);
      return ans === 'YES';
    } catch (err) {
      console.error('Self-Reflection check failed:', err.message);
      return true; // Fallback to avoid retrying in case of rate limits
    }
  }
}

module.exports = new ContextService();
