/**
 * storageService.js
 *
 * Drop-in replacement for in-memory storage.
 * Keeps the same function signatures used by roomManager and versionManager.
 * Falls back to in-memory Maps gracefully when DB is unavailable.
 *
 * Public API (unchanged signatures):
 *   saveDocument(roomId, data)          → saved document object
 *   loadDocument(roomId)                → document object | null
 *   listDocuments()                     → array of document summaries
 *   saveVersion(roomId, content, savedBy, maxVersions)  → version object
 *   getVersionHistory(roomId, limit)    → array (no content field)
 *   restoreVersion(roomId, versionNumber) → { content } | null
 */

const USE_DB = process.env.USE_DB_STORAGE === 'true';

// Lazy-require models only when DB mode is active to avoid mongoose
// connection errors in pure in-memory mode.
let Document, Version;
if (USE_DB) {
  try {
    Document = require('../models/Document');
    Version  = require('../models/Version');
  } catch (e) {
    console.warn('[storageService] Could not load DB models, falling back to in-memory.', e.message);
  }
}

// ─── In-memory fallback stores ────────────────────────────────────────────────
const memDocuments = new Map(); // roomId → { roomId, content, title, ... }
const memVersions  = new Map(); // roomId → [ { versionNumber, content, savedBy, createdAt } ]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isDBReady() {
  return USE_DB && Document && Version;
}

function memSaveDoc(roomId, data) {
  const existing = memDocuments.get(roomId) || { roomId, content: '', title: 'Untitled Document' };
  const updated = { ...existing, ...data, roomId, lastActivityAt: new Date() };
  if (data.content !== undefined) {
    updated.charCount = data.content.length;
    updated.wordCount = data.content.trim() ? data.content.trim().split(/\s+/).length : 0;
  }
  memDocuments.set(roomId, updated);
  return updated;
}

function memGetNextVersionNumber(roomId) {
  const versions = memVersions.get(roomId) || [];
  return versions.length ? versions[versions.length - 1].versionNumber + 1 : 1;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Persist document content + metadata for a room.
 * @param {string} roomId
 * @param {object} data  – any subset of { content, title, lastEditedBy }
 * @returns {Promise<object>} saved document
 */
async function saveDocument(roomId, data = {}) {
  if (isDBReady()) {
    try {
      return await Document.upsertByRoom(roomId, data);
    } catch (err) {
      console.error("[storageService] saveDocument DB error:", err.message);
      throw err;   // ✅ CORRECT
    }
  }
  return memSaveDoc(roomId, data);
}

/**
 * Load document for a room.
 * @param {string} roomId
 * @returns {Promise<object|null>}
 */
async function loadDocument(roomId) {
  if (isDBReady()) {
    try {
      return await Document.findByRoom(roomId);
    } catch (err) {
      console.error('[storageService] loadDocument DB error, using memory fallback:', err.message);
    }
  }
  return memDocuments.get(roomId) || null;
}

/**
 * List all documents (lightweight summary, no full content).
 * @returns {Promise<object[]>}
 */
async function listDocuments() {
  if (isDBReady()) {
    try {
      return await Document.listAll();
    } catch (err) {
      console.error('[storageService] listDocuments DB error, using memory fallback:', err.message);
    }
  }
  return Array.from(memDocuments.values()).map(({ roomId, title, wordCount, lastActivityAt }) => ({
    roomId, title, wordCount, lastActivityAt,
  }));
}

/**
 * Save a new version snapshot.
 * @param {string} roomId
 * @param {string} content
 * @param {string} [savedBy='system']
 * @param {number} [maxVersions=50]
 * @returns {Promise<object>}
 */
async function saveVersion(roomId, content, savedBy = 'system', maxVersions = 50) {
  if (isDBReady()) {
    try {
      return await Version.saveVersion(roomId, content, savedBy, maxVersions);
    } catch (err) {
      console.error('[storageService] saveVersion DB error, using memory fallback:', err.message);
    }
  }

  // In-memory version save
  const versions = memVersions.get(roomId) || [];
  const versionNumber = memGetNextVersionNumber(roomId);
  const version = {
    roomId,
    versionNumber,
    content,
    savedBy,
    label: `Auto-save #${versionNumber}`,
    charCount: content.length,
    wordCount: content.trim() ? content.trim().split(/\s+/).length : 0,
    createdAt: new Date(),
  };
  versions.push(version);
  // Enforce cap
  if (versions.length > maxVersions) {
    versions.splice(0, versions.length - maxVersions);
  }
  memVersions.set(roomId, versions);
  return version;
}

/**
 * Get version history list for a room (no content field for efficiency).
 * @param {string} roomId
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
async function getVersionHistory(roomId, limit = 50) {
  if (isDBReady()) {
    try {
      return await Version.getHistory(roomId, limit);
    } catch (err) {
      console.error('[storageService] getVersionHistory DB error, using memory fallback:', err.message);
    }
  }

  const versions = (memVersions.get(roomId) || [])
    .slice(-limit)
    .reverse()
    .map(({ roomId, versionNumber, savedBy, label, wordCount, charCount, createdAt }) => ({
      roomId, versionNumber, savedBy, label, wordCount, charCount, createdAt,
    }));
  return versions;
}

/**
 * Restore (retrieve content of) a specific version.
 * @param {string} roomId
 * @param {number} versionNumber
 * @returns {Promise<object|null>}  object with at least { content }
 */
async function restoreVersion(roomId, versionNumber) {
  if (isDBReady()) {
    try {
      return await Version.getVersion(roomId, versionNumber);
    } catch (err) {
      console.error('[storageService] restoreVersion DB error, using memory fallback:', err.message);
    }
  }

  const versions = memVersions.get(roomId) || [];
  return versions.find((v) => v.versionNumber === versionNumber) || null;
}
/**
 * Get storage statistics (DB + memory fallback)
 */
async function getStorageStats() {
  if (isDBReady()) {
    try {
      const totalDocs = await Document.countDocuments();
      const totalVersions = await Version.countDocuments();

      const latestDocs = await Document.find({})
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('roomId title wordCount updatedAt');

      return {
        type: 'database',
        totalDocuments: totalDocs,
        totalVersions: totalVersions,
        recentDocuments: latestDocs,
      };
    } catch (err) {
      console.error('[storageService] getStorageStats DB error:', err.message);
    }
  }

  // 🔁 Fallback (memory mode)
  return {
    type: 'memory',
    totalDocuments: memDocuments.size,
    totalVersions: Array.from(memVersions.values()).reduce(
      (sum, v) => sum + v.length,
      0
    ),
    recentDocuments: Array.from(memDocuments.values())
      .slice(-5)
      .map(doc => ({
        roomId: doc.roomId,
        title: doc.title,
        wordCount: doc.wordCount,
        updatedAt: doc.lastActivityAt
      })),
  };
}
module.exports = {
  saveDocument,
  loadDocument,
  listDocuments,
  saveVersion,
  getVersionHistory,
  restoreVersion,
  getStorageStats 
};