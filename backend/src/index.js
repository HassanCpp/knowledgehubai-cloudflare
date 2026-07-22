require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { initQdrant } = require('./config/qdrant');
const crawlService = require('./services/crawl.service');
const { errorHandler } = require('./middleware/error.middleware');

// Route imports
const authRoutes = require('./routes/auth.routes');
const documentRoutes = require('./routes/document.routes');
const crawlRoutes = require('./routes/crawl.routes');
const queryRoutes = require('./routes/query.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors({
  origin: '*', // Allow all origins for testing/development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/crawl', crawlRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/admin', adminRoutes);

// Base test route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Global error handler
app.use(errorHandler);

// Database connection & startup sequence
const startServer = async () => {
  console.log('Starting KnowledgeHubAI Backend Server...');
  
  // 1. Connect MongoDB
  await connectDB();

  // 2. Connect Qdrant
  await initQdrant();

  // 3. Start crawler scheduler
  crawlService.startScheduler();

  // 4. Start HTTP server
  app.listen(PORT, () => {
    console.log(`Backend server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Fatal startup error:', error.message);
  process.exit(1);
});
