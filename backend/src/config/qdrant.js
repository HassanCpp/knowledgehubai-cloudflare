const { QdrantClient } = require('@qdrant/js-client-rest');

const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
const qdrantApiKey = process.env.QDRANT_API_KEY || undefined;

const qdrantClient = new QdrantClient({
  url: qdrantUrl,
  apiKey: qdrantApiKey,
});

const COLLECTION_NAME = 'document_chunks';
const CACHE_COLLECTION_NAME = 'semantic_cache';

const initQdrant = async () => {
  try {
    const collections = await qdrantClient.getCollections();
    const names = collections.collections.map((c) => c.name);

    // Initialize document chunks collection
    if (!names.includes(COLLECTION_NAME)) {
      console.log(`Qdrant collection "${COLLECTION_NAME}" not found. Creating...`);
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 1536, // Dimension for text-embedding-3-small
          distance: 'Cosine',
        },
      });
      console.log(`Qdrant collection "${COLLECTION_NAME}" created successfully.`);

      // Create payload indexes for strict mode queries
      console.log('Creating keyword payload indexes for faster filtered retrieval...');
      await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'type',
        field_schema: 'keyword',
      });
      await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'classification',
        field_schema: 'keyword',
      });
      await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'documentId',
        field_schema: 'keyword',
      });
      await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'filename',
        field_schema: 'keyword',
      });
      console.log('Qdrant payload indexes created successfully.');
    } else {
      console.log(`Qdrant collection "${COLLECTION_NAME}" already exists.`);
      // Ensure indexes exist even if collection was pre-created
      try {
        await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'type',
          field_schema: 'keyword',
        });
        await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'classification',
          field_schema: 'keyword',
        });
        await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'documentId',
          field_schema: 'keyword',
        });
        await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
          field_name: 'filename',
          field_schema: 'keyword',
        });
      } catch (err) {
        // Ignore if indexes already exist
      }
    }

    // Initialize semantic cache collection
    if (!names.includes(CACHE_COLLECTION_NAME)) {
      console.log(`Qdrant collection "${CACHE_COLLECTION_NAME}" not found. Creating...`);
      await qdrantClient.createCollection(CACHE_COLLECTION_NAME, {
        vectors: {
          size: 1536,
          distance: 'Cosine',
        },
      });
      console.log(`Qdrant collection "${CACHE_COLLECTION_NAME}" created successfully.`);
    } else {
      console.log(`Qdrant collection "${CACHE_COLLECTION_NAME}" already exists.`);
    }
  } catch (error) {
    console.error('Failed to initialize Qdrant client or collections:', error.message);
  }
};

module.exports = {
  qdrantClient,
  initQdrant,
  COLLECTION_NAME,
  CACHE_COLLECTION_NAME,
};
