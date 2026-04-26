/**
 * Socket.IO Configuration
 * Centralized configuration for WebSocket server
 */

require('dotenv').config();

module.exports = {
  // CORS settings
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://192.168.2.18:3000"  // ✅ your frontend IP
    ],
    methods: ["GET", "POST"],
    credentials: true
  },

  // Connection settings
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000,
  
  // Transport protocols
  transports: ['websocket', 'polling'],
  
  // Upgrade timeout
  upgradeTimeout: 10000,
  
  // Max HTTP buffer size
  maxHttpBufferSize: 1e6, // 1MB
  
  // Allow upgrades
  allowUpgrades: true,
  
  // Compression
  perMessageDeflate: {
    threshold: 1024
  },

  // Cookie settings
  cookie: false
};