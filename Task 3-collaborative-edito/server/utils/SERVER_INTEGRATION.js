/**
 * server.js  —  INTEGRATION PATCH
 *
 * Add the lines marked ADD to your existing server.js.
 * Do NOT remove or rearrange any existing code.
 *
 * ─────────────────────────────────────────────────────────────
 * 1. At the top, with your other requires:
 * ─────────────────────────────────────────────────────────────
 */

// ADD ↓
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const { initSocketAuth } = require('./socketAuthIntegration');
// ADD ↑

/**
 * ─────────────────────────────────────────────────────────────
 * 2. After `const app = express();` and before any routes,
 *    add JSON body parsing if not already present:
 * ─────────────────────────────────────────────────────────────
 */

// ADD ↓
app.use(express.json());
// ADD ↑ (safe to add even if already present — express dedupes)

/**
 * ─────────────────────────────────────────────────────────────
 * 3. Register the new routes (add after your existing routes):
 * ─────────────────────────────────────────────────────────────
 */

// ADD ↓
app.use('/auth', authRoutes);
app.use('/documents', documentRoutes);
// ADD ↑

/**
 * ─────────────────────────────────────────────────────────────
 * 4. After `const io = new Server(server, ...)` (or however
 *    you create your io instance), add:
 * ─────────────────────────────────────────────────────────────
 */

// ADD ↓
initSocketAuth(io);
// ADD ↑

/**
 * ─────────────────────────────────────────────────────────────
 * 5. Connect MongoDB before server.listen():
 * ─────────────────────────────────────────────────────────────
 */

// ADD ↓
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('[DB] MongoDB connected'))
  .catch((err) => console.error('[DB] connection error:', err));
// ADD ↑

/**
 * ─────────────────────────────────────────────────────────────
 * 6. Add a global async error handler after all routes:
 * ─────────────────────────────────────────────────────────────
 */

// ADD ↓
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});
// ADD ↑

/**
 * ─────────────────────────────────────────────────────────────
 * 7. Required .env additions:
 * ─────────────────────────────────────────────────────────────
 *
 * MONGODB_URI=mongodb://localhost:27017/syncspace
 * JWT_SECRET=change-this-to-a-long-random-string
 * JWT_EXPIRES_IN=7d
 *
 * ─────────────────────────────────────────────────────────────
 * 8. Required npm packages:
 * ─────────────────────────────────────────────────────────────
 *
 * npm install mongoose bcryptjs jsonwebtoken express-validator uuid
 */
