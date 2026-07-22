require('dotenv').config();
const mongoose = require('mongoose');
const { initQdrant } = require('../config/qdrant');
const User = require('../models/User');
const pipelineService = require('../services/pipeline.service');

const runTestQuery = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not defined in backend/.env.');
    process.exit(1);
  }

  try {
    // 1. Connect databases
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(uri);
    console.log('MongoDB Connected.');
    await initQdrant();

    // 2. Retrieve the Admin user we created to mock the query requester
    const user = await User.findOne({ email: 'hassanwaqar475@gmail.com' });
    if (!user) {
      console.error('Test admin user not found. Please run setup_admin.js first.');
      process.exit(1);
    }

    const query = 'Can I exchange a document license?';
    const sessionId = 'test_session_123';

    console.log('\n----------------------------------------------------');
    console.log(`Executing Query: "${query}"`);
    console.log('----------------------------------------------------');

    // 3. Mock Express response object to observe SSE stream output
    const mockRes = {
      setHeader: (name, val) => {},
      flushHeaders: () => {},
      write: (dataString) => {
        // SSE lines look like: data: {"type": "token", "content": "..."}
        if (dataString.startsWith('data: ')) {
          try {
            const payload = JSON.parse(dataString.substring(6).trim());
            if (payload.type === 'token') {
              process.stdout.write(payload.content); // Output tokens in real-time
            } else if (payload.type === 'metadata') {
              console.log(`[Metadata Event] Intent: ${payload.intent}. Sources count: ${payload.sources ? payload.sources.length : 0}`);
              if (payload.cached) {
                console.log(`[Cache Hit] Serving from cache...`);
              }
              console.log('Streaming Answer:');
            }
          } catch (e) {
            // Ignore parse errors for raw carriage returns
          }
        }
      },
      end: () => {
        console.log('\n----------------------------------------------------');
        console.log('[✓] SUCCESS: Query Stream Finished!');
        console.log('----------------------------------------------------');
        process.exit(0);
      }
    };

    // 4. Run pipeline query stream
    await pipelineService.executeQueryStream({
      query,
      userId: user._id,
      sessionId,
      res: mockRes,
    });

  } catch (error) {
    console.error('Query pipeline verification failed:', error.stack);
    process.exit(1);
  }
};

runTestQuery();
