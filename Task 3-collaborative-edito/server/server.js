/**
 * Main Server Entry Point - UPDATED
 * Express + Socket.IO server with AI, Analytics, Versions
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

console.log("ENV CHECK:", process.env.MONGODB_URI);
const connectDB = require('./config/db');

connectDB()
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ DB CONNECTION FAILED:", err);
    process.exit(1);
  });
console.log("DB CONNECT CALLING...");
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const os = require('os');

const socketConfig = require('./config/socket.config');
const { initializeSocketHandlers } = require('./handlers/socketHandler');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { authenticateSocket } = require('./middleware/auth');
const roomManager = require('./managers/roomManager');
const versionManager = require('./managers/versionManager');
const analyticsManager = require('./managers/analyticsManager');
const storageService = require('./services/storageService');
const logger = require('./utils/logger');
const exportRoutes = require('./routes/exportRoutes');
// Initialize Express app

const app = express();
const server = http.createServer(app);

const aiRoutes = require('./routes/ai');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/document');


// Initialize Socket.IO with configuration
const io = new Server(server, socketConfig);
io.use(authenticateSocket);
// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS || '').split(',')
    : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(compression());

// ✅ MOVE STATIC HERE (VERY IMPORTANT)
app.use(express.static(path.join(__dirname, '../client')));

// ✅ THEN API ROUTES
app.use('/api/export', exportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// ============================================
// API ROUTES
// ============================================

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    app: process.env.APP_NAME || 'SyncSpace AI',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

/**
 * System statistics
 */
app.get('/api/stats', (req, res) => {
  const roomStats = roomManager.getSystemStats();
  const analyticsStats = analyticsManager.getSystemStats();
  
  res.json({
    success: true,
    data: {
      rooms: roomStats,
      analytics: analyticsStats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: Date.now()
    }
  });
});

/**
 * Storage statistics
 */
app.get('/api/storage-stats', async (req, res) => {
  try {
    const stats = await storageService.getStorageStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get storage stats'
    });
  }
});

/**
 * List documents
 */


/**
 * Server info endpoint
 */
app.get('/api/info', (req, res) => {
  res.json({
    success: true,
    data: {
      name: process.env.APP_NAME || 'SyncSpace AI',
      tagline: process.env.APP_TAGLINE || 'Intelligent Real-Time Collaborative Workspace',
      version: '2.0.0',
      features: [
        'Real-time collaboration',
        'AI writing assistant',
        'Document analytics',
        'Version history',
        'Contribution tracking',
        'Role-based permissions'
      ],
      endpoints: {
        health: '/api/health',
        info: '/api/info',
        stats: '/api/stats',
        documents: '/api/documents',
        socket: '/socket.io'
      }
    }
  });
});

/**
 * Network info
 */
app.get('/api/network-info', (req, res) => {
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];
  
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    networkInterfaces[interfaceName].forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          interface: interfaceName,
          address: iface.address,
          url: `http://${iface.address}:${process.env.PORT || 3000}`
        });
      }
    });
  });
  
  res.json({
    success: true,
    data: {
      port: process.env.PORT || 3000,
      addresses: addresses
    }
  });
});

/**
 * Serve frontend
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ============================================
// ERROR HANDLING
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// SOCKET.IO INITIALIZATION
// ============================================

initializeSocketHandlers(io);

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];
  
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    networkInterfaces[interfaceName].forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    });
  });

  console.log('\n' + '='.repeat(70));
  console.log(`  ${process.env.APP_NAME || 'SyncSpace AI'}`);
  console.log(`  ${process.env.APP_TAGLINE || 'Intelligent Real-Time Collaborative Workspace'}`);
  console.log('='.repeat(70));
  console.log(`  Server:        http://localhost:${PORT}`);
  console.log(`  Local IP:      http://127.0.0.1:${PORT}`);
  
  if (addresses.length > 0) {
    addresses.forEach((addr, index) => {
      console.log(`  Network ${index + 1}:     http://${addr}:${PORT}`);
    });
  }
  
  console.log(`  Socket.IO:     Enabled`);
  console.log(`  AI Features:   ${process.env.AI_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
  console.log(`  Storage:       ${process.env.USE_DB_STORAGE === 'true' ? 'Enabled' : 'Disabled'}`);
  console.log(`  Environment:   ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Version:       2.0.0`);
  console.log('='.repeat(70) + '\n');
  
  logger.info('Server started successfully', { 
    port: PORT, 
    host: HOST, 
    networkAddresses: addresses 
  });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    io.close(() => {
      logger.info('Socket.IO server closed');
      process.exit(0);
    });
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('uncaughtException', (error) => {
  console.error("UNCAUGHT EXCEPTION FULL ERROR:");
  console.error(error);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});
