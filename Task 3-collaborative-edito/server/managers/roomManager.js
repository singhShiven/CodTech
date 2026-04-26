/**
 * roomManager.js
 *
 * Hybrid mode: in-memory Map is the primary source of truth for live sessions.
 * storageService writes through to DB asynchronously so data survives restarts.
 * Function signatures are unchanged from the original in-memory version.
 */

const storageService = require('../services/storageService');

class RoomManager {
  constructor() {
    // Primary in-memory store (unchanged shape)
    this.rooms = new Map();
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  _defaultRoom(roomId) {
    return {
      id: roomId,
      content: '',
      users: new Map(),      // socketId → { username, color, cursor }
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };
  }

  /** Fire-and-forget DB write — never throws into callers */
  async _persist(roomId, data) {
    try {
      await storageService.saveDocument(roomId, data);
    } catch (err) {
      console.error('[roomManager] persist error:', err.message);
    }
  }

  // ─── Room lifecycle ──────────────────────────────────────────────────────────

  /**
   * Get or create a room. Loads persisted content from DB on first access.
   * @param {string} roomId
   * @returns {Promise<object>} room object
   */
  async getOrCreateRoom(roomId) {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId);
    }

    // Try to rehydrate from DB
    const room = this._defaultRoom(roomId);
    try {
      const saved = await storageService.loadDocument(roomId);
      if (saved) {
        room.content = saved.content || '';
        room.title   = saved.title   || 'Untitled Document';
      }
    } catch (err) {
      console.error('[roomManager] loadDocument error:', err.message);
    }

    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Synchronous get (returns null if room not in memory yet).
   * Kept for callers that don't await — they should prefer getOrCreateRoom.
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  roomExists(roomId) {
    return this.rooms.has(roomId);
  }

  // ─── Content ─────────────────────────────────────────────────────────────────

  /**
   * Update room content in memory and persist to DB.
   * @param {string} roomId
   * @param {string} content
   * @param {string} [username]
   * @returns {object} room
   */
  updateContent(roomId, content, username) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.content         = content;
    room.lastActivityAt  = new Date();

    // Async write-through — does not block the socket event
    if (typeof content === 'string' && content.trim().length > 0) {
      this._persist(roomId, { content, lastEditedBy: username || null });
    }

    return room;
  }

  getContent(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.content : '';
  }

  // ─── Users ───────────────────────────────────────────────────────────────────

  addUser(roomId, socketId, username, color) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.users.set(socketId, { username, color, cursor: null });
    room.lastActivityAt = new Date();
    return room;
  }

  removeUser(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.users.delete(socketId);
    room.lastActivityAt = new Date();

    // Clean up empty rooms from memory (DB record is kept for persistence)
    if (room.users.size === 0) {
      const versionManager = require('./versionManager');
      versionManager.stopAutoSave(roomId);
      this.rooms.delete(roomId);
    }
    return room;
  }

  getUsers(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
  
    return Array.from(room.users.entries()).map(([socketId, data]) => ({
      userId: socketId,          // 🔥 CRITICAL FIX
      username: data.username,
      status: data.status || 'online',
      color: data.color
    }));
  }

  updateCursor(roomId, socketId, cursor) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const user = room.users.get(socketId);
    if (user) user.cursor = cursor;
    return room;
  }

  // ─── Listing (uses DB when available) ────────────────────────────────────────

  /**
   * List all known documents (active in memory + persisted in DB).
   * @returns {Promise<object[]>}
   */
  async listRooms() {
    try {
      return await storageService.listDocuments();
    } catch (err) {
      console.error('[roomManager] listDocuments error:', err.message);
      // Fallback: return active in-memory rooms
      return Array.from(this.rooms.entries()).map(([roomId, room]) => ({
        roomId,
        title: room.title || 'Untitled Document',
        wordCount: room.content
          ? room.content.trim().split(/\s+/).length
          : 0,
        lastActivityAt: room.lastActivityAt,
      }));
    }
  }
  getSystemStats(){
    return {
      totalRooms: this.rooms.size,
      totalUsers: Array.from(this.rooms.values())
        .reduce((sum, room) => sum + room.users.size, 0),
      activeRooms: Array.from(this.rooms.values())
        .filter(room => room.users.size > 0).length
    };
  }
}

module.exports = new RoomManager();