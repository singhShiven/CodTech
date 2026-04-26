/**
 * versionManager.js
 *
 * Hybrid mode: in-memory Map buffers recent versions for fast access.
 * storageService writes through to DB so history survives restarts.
 * Function signatures are unchanged from the original in-memory version.
 */

const storageService = require('../services/storageService');

const MAX_VERSIONS     = 50;   // matches original limit
const AUTOSAVE_MS      = 10000; // 10 seconds, matches original behaviour

class VersionManager {
  constructor() {
    // In-memory cache: roomId → [ { versionNumber, content, savedBy, createdAt } ]
    this.versions = new Map();

    // Auto-save interval handles (roomId → intervalId)
    this._intervals = new Map();
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  _getMemVersions(roomId) {
    if (!this.versions.has(roomId)) {
      this.versions.set(roomId, []);
    }
    return this.versions.get(roomId);
  }

  _nextMemVersionNumber(roomId) {
    const list = this._getMemVersions(roomId);
    return list.length ? list[list.length - 1].versionNumber + 1 : 1;
  }

  // ─── Save version ─────────────────────────────────────────────────────────────

  /**
   * Save a new version snapshot.
   * Writes to DB (async) and updates in-memory cache.
   *
   * @param {string} roomId
   * @param {string} content
   * @param {string} [savedBy='system']
   * @returns {Promise<object>} saved version
   */
  async saveVersion(roomId, content, savedBy = 'system') {
    if (!content || typeof content !== 'string') return null;
  
    const list = this._getMemVersions(roomId);
    const last = list[list.length - 1];
  
    // 🚀 PREVENT DUPLICATES
    if (last && last.content === content) {
      return last;
    }
  
    let version;
  
    try {
      version = await storageService.saveVersion(
        roomId,
        content,
        savedBy,
        MAX_VERSIONS
      );
    } catch (err) {
      console.error('[versionManager] DB error:', err.message);
  
      version = {
        roomId,
        versionNumber: this._nextMemVersionNumber(roomId),
        content,
        savedBy,
        createdAt: new Date(),
      };
    }
  
    // store in memory
    list.push(version);
  
    if (list.length > MAX_VERSIONS) {
      list.splice(0, list.length - MAX_VERSIONS);
    }
  
    return version;
  }

  // ─── Get history ──────────────────────────────────────────────────────────────

  /**
   * Get version history list for a room (no content for efficiency).
   * Prefers DB; falls back to in-memory cache.
   *
   * @param {string} roomId
   * @param {number} [limit=50]
   * @returns {Promise<object[]>}
   */
  async getVersionHistory(roomId, limit = MAX_VERSIONS) {
    try {
      const history = await storageService.getVersionHistory(roomId, limit);
      if (history && history.length > 0) return history;
    } catch (err) {
      console.error('[versionManager] getVersionHistory DB error:', err.message);
    }

    // Fallback: return in-memory cache (without content)
    return (this._getMemVersions(roomId))
      .slice(-limit)
      .reverse()
      .map(({ roomId, versionNumber, savedBy, label, createdAt }) => ({
        roomId, versionNumber, savedBy, label, createdAt,
      }));
  }

  // ─── Restore version ─────────────────────────────────────────────────────────

  /**
   * Restore a specific version — returns the full object including content.
   * Prefers DB; falls back to in-memory cache.
   *
   * @param {string} roomId
   * @param {number} versionNumber
   * @returns {Promise<object|null>}
   */
  async restoreVersion(roomId, versionNumber) {
    try {
      const version = await storageService.restoreVersion(roomId, versionNumber);
      if (version) return version;
    } catch (err) {
      console.error('[versionManager] restoreVersion DB error:', err.message);
    }

    // Fallback: search in-memory cache (has content)
    const list = this._getMemVersions(roomId);
    return list.find((v) => v.versionNumber === versionNumber) || null;
  }

  // ─── Auto-save ────────────────────────────────────────────────────────────────

  /**
   * Start the auto-save interval for a room.
   * getContent is a callback provided by roomManager to avoid circular deps.
   *
   * @param {string} roomId
   * @param {function} getContent  – () => string
   */
  startAutoSave(roomId, getContent) {
    if (this._intervals.has(roomId)) return; // already running

    const intervalId = setInterval(async () => {
      const content = getContent();

if (!content || content.trim().length === 0) return;

// 🚀 CHECK LAST VERSION
const list = this._getMemVersions(roomId);
const last = list[list.length - 1];

// ❌ skip duplicate autosave
if (last && last.content === content) return;

await this.saveVersion(roomId, content, 'system');
    }, AUTOSAVE_MS);

    this._intervals.set(roomId, intervalId);
  }

  /**
   * Stop the auto-save interval for a room (call when room becomes empty).
   * @param {string} roomId
   */
  stopAutoSave(roomId) {
    const intervalId = this._intervals.get(roomId);
    if (intervalId) {
      clearInterval(intervalId);
      this._intervals.delete(roomId);
    }
  }

  /**
   * Clear in-memory version cache for a room (does NOT delete from DB).
   * @param {string} roomId
   */
  clearMemCache(roomId) {
    this.versions.delete(roomId);
  }
}

module.exports = new VersionManager();