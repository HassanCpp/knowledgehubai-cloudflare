require('dotenv').config();
const { qdrantClient, COLLECTION_NAME } = require('../config/qdrant');

const diag = async () => {
  try {
    console.log('Qdrant URL:', process.env.QDRANT_URL || 'http://localhost:6333');
    
    // Get collection info
    const info = await qdrantClient.getCollection(COLLECTION_NAME);
    console.log('Collection Info:', JSON.stringify(info, null, 2));

    // Try creating the payload index directly and logging the response
    console.log('Attempting to create payload index for "type" keyword...');
    try {
      const res = await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'type',
        field_schema: 'keyword',
        wait: true,
      });
      console.log('Payload index creation API result:', res);
    } catch (e) {
      console.error('Payload index creation failed:', e.message);
      if (e.response) {
        console.error('Payload index error response:', e.response);
      }
    }

    // Try a dummy search with 1536 size vector of 0s, with no filter
    console.log('Testing dummy search with no filter...');
    const dummyVector = new Array(1536).fill(0.01);
    
    try {
      const res = await qdrantClient.search(COLLECTION_NAME, {
        vector: dummyVector,
        limit: 2,
      });
      console.log(`Dummy search success! Found ${res.length} points.`);
    } catch (e) {
      console.error('Dummy search failed:', e.message);
    }

    // Try dummy search with default filter
    console.log('Testing dummy search with default filter...');
    try {
      const res = await qdrantClient.search(COLLECTION_NAME, {
        vector: dummyVector,
        limit: 2,
        filter: {
          must: [
            {
              key: 'type',
              match: {
                value: 'small'
              }
            }
          ]
        }
      });
      console.log(`Filter search success! Found ${res.length} points.`);
    } catch (e) {
      console.error('Filter search failed:', e.message);
    }
  } catch (error) {
    console.error('Diagnostic failed:', error);
  }
  process.exit(0);
};

diag();
