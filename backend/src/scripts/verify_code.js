/**
 * Backend Syntax & Import Verification Script
 * Validates that all controllers, models, routes, and services compile and import without errors.
 */

const path = require('path');
const fs = require('fs');

console.log('--- Starting Codebase Import & Syntax Verification ---');

const filesToVerify = [
  // Config
  '../config/db.js',
  '../config/openai.js',
  '../config/qdrant.js',
  // Models
  '../models/User.js',
  '../models/Session.js',
  '../models/ChatHistory.js',
  '../models/UploadedDocument.js',
  '../models/DocumentChunk.js',
  '../models/QueryLog.js',
  '../models/RetrievalLog.js',
  '../models/FallbackLog.js',
  '../models/QueryCache.js',
  '../models/SemanticCache.js',
  '../models/FaqCache.js',
  '../models/DocumentHash.js',
  '../models/UserMemory.js',
  '../models/WebSource.js',
  '../models/CrawlHistory.js',
  '../models/SystemMetrics.js',
  // Middleware
  '../middleware/auth.middleware.js',
  '../middleware/roles.middleware.js',
  '../middleware/error.middleware.js',
  // Services
  '../services/auth.service.js',
  '../services/ingestion.service.js',
  '../services/indexing.service.js',
  '../services/crawl.service.js',
  '../services/classifier.service.js',
  '../services/query-preprocessor.service.js',
  '../services/context.service.js',
  '../services/pipeline.service.js',
  '../services/analytics.service.js',
  // Processors
  '../processors/BaseProcessor.js',
  '../processors/PDFProcessor.js',
  '../processors/ScannedPDFProcessor.js',
  '../processors/WordProcessor.js',
  '../processors/TextProcessor.js',
  '../processors/MarkdownProcessor.js',
  '../processors/CSVProcessor.js',
  '../processors/ExcelProcessor.js',
  '../processors/ImageProcessor.js',
  '../processors/DocumentProcessorRegistry.js',
  // Chunkers
  '../chunkers/AdaptiveChunker.js',
  // Embedders
  '../embedders/OpenAIEmbedder.js',
  // Retrievers
  '../retrievers/DenseRetriever.js',
  '../retrievers/SparseRetriever.js',
  '../retrievers/MultiRetriever.js',
  // Rankers
  '../rankers/ReRanker.js',
  // Caches
  '../caches/CacheManager.js',
  // Routes
  '../routes/auth.routes.js',
  '../routes/document.routes.js',
  '../routes/crawl.routes.js',
  '../routes/query.routes.js',
  '../routes/admin.routes.js',
];

let errorsFound = 0;

filesToVerify.forEach((relPath) => {
  const absPath = path.resolve(__dirname, relPath);
  try {
    // Attempt to require the file
    require(absPath);
    console.log(`[✓] SUCCESS: Loaded module ${relPath}`);
  } catch (error) {
    console.error(`[✗] FAILED: Module ${relPath} could not be loaded!`);
    console.error(`    Error details: ${error.stack}\n`);
    errorsFound++;
  }
});

console.log('----------------------------------------------------');
if (errorsFound === 0) {
  console.log('All backend modules loaded successfully with zero compilation or syntax errors! [Codebase is Valid]');
  process.exit(0);
} else {
  console.error(`Syntax verification failed with ${errorsFound} errors.`);
  process.exit(1);
}
