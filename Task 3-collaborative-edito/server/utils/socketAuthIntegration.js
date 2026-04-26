/**
 * socketAuthIntegration.js
 *
 * Wire JWT validation + DB auto-save into the existing Socket.IO server.
 * Call initSocketAuth(io) once, right after your existing io setup.
 * This does NOT modify socketHandler.js.
 */

const { authenticateSocket } = require('./middleware/auth');
const Document = require('./models/Document');

const SAVE_DEBOUNCE_MS = 3000;
const saveTimers = new Map();

function initSocketAuth(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      socket.user = null;
      return next();
    }

    try {
      await authenticateSocket(socket, next);
    } catch (err) {
      socket.user = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?._id?.toString() || null;

    socket.on('join-room', async ({ roomId }) => {
      if (!roomId) return;

      if (userId) {
        const doc = await Document.findOne({ roomId });
        if (doc && !doc.hasAccess(socket.user._id)) {
          socket.emit('error', { message: 'Access denied to this document' });
          return;
        }
      }
    });

    socket.on('content-change', ({ roomId, content }) => {
      if (!roomId || content === undefined) return;

      const key = `${roomId}:${userId || socket.id}`;
      clearTimeout(saveTimers.get(key));

      const timer = setTimeout(async () => {
        saveTimers.delete(key);
        try {
          await Document.findOneAndUpdate(
            { roomId },
            { content, updatedAt: new Date() },
            { new: false }
          );
        } catch (err) {
          console.error('[socketAuth] auto-save error:', err.message);
        }
      }, SAVE_DEBOUNCE_MS);

      saveTimers.set(key, timer);
    });

    socket.on('disconnect', () => {
      for (const [key, timer] of saveTimers.entries()) {
        if (key.includes(socket.id)) {
          clearTimeout(timer);
          saveTimers.delete(key);
        }
      }
    });
  });
}

module.exports = { initSocketAuth };
