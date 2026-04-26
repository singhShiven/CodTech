/**
 * analyticsManager.js - FIXED
 *
 * CHANGES:
 * 1. getRealTimeAnalytics() and getContributionPercentages() now auto-init
 *    the room on first call instead of returning null — prevents the
 *    analytics-update handler from emitting empty/null data.
 * 2. All methods guard against missing room gracefully.
 * 3. generateSessionSummary() never returns null.
 */

const logger = require('../utils/logger');

class AnalyticsManager {
  constructor() {
    this.roomAnalytics      = new Map(); // roomId -> analytics data
    this.userContributions  = new Map(); // roomId -> Map(userId -> contribution)
  }

  // ── Auto-init room ────────────────────────────────────────────────────────────
  initializeRoom(roomId) {
    if (!this.roomAnalytics.has(roomId)) {
      this.roomAnalytics.set(roomId, {
        roomId,
        createdAt:            Date.now(),
        totalEdits:           0,
        totalCharactersTyped: 0,
        sessions:             []
      });
      this.userContributions.set(roomId, new Map());
      logger.info(`[Analytics] Room initialised: ${roomId}`);
    }
  }

  // ── Track edit ────────────────────────────────────────────────────────────────
  trackEdit(roomId, userId, username, editData = {}) {
    this.initializeRoom(roomId); // safe auto-init

    const room  = this.roomAnalytics.get(roomId);
    const users = this.userContributions.get(roomId);

    room.totalEdits++;
    room.totalCharactersTyped += editData.charactersAdded || 0;

    if (!users.has(userId)) {
      users.set(userId, {
        userId, username,
        edits: 0, charactersAdded: 0, charactersRemoved: 0,
        firstEdit: Date.now(), lastEdit: Date.now(), timeActive: 0
      });
    }

    const u = users.get(userId);
    u.edits++;
    u.charactersAdded   += editData.charactersAdded   || 0;
    u.charactersRemoved += editData.charactersRemoved || 0;
    u.lastEdit    = Date.now();
    u.timeActive  = u.lastEdit - u.firstEdit;
  }

  // ── Track session ─────────────────────────────────────────────────────────────
  trackSession(roomId, userId, username, action) {
    this.initializeRoom(roomId);

    const room = this.roomAnalytics.get(roomId);

    if (action === 'join') {
      room.sessions.push({ userId, username, joinedAt: Date.now(), leftAt: null, duration: null });
    } else if (action === 'leave') {
      const session = [...room.sessions].reverse().find(s => s.userId === userId && !s.leftAt);
      if (session) {
        session.leftAt   = Date.now();
        session.duration = session.leftAt - session.joinedAt;
      }
    }
  }

  // ── Contribution percentages ──────────────────────────────────────────────────
  getContributionPercentages(roomId) {
    this.initializeRoom(roomId); // auto-init so we never return null

    const users      = this.userContributions.get(roomId);
    const totalEdits = Array.from(users.values()).reduce((n, u) => n + u.edits, 0);

    if (totalEdits === 0) return [];

    return Array.from(users.values())
      .map(u => ({
        userId:           u.userId,
        username:         u.username,
        edits:            u.edits,
        percentage:       Math.round((u.edits / totalEdits) * 100),
        charactersAdded:  u.charactersAdded,
        charactersRemoved:u.charactersRemoved,
        timeActive:       u.timeActive
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }

  getMostActiveCollaborator(roomId) {
    const contributions = this.getContributionPercentages(roomId);
    return contributions.length > 0 ? contributions[0] : null;
  }

  // ── Real-time analytics ───────────────────────────────────────────────────────
  getRealTimeAnalytics(roomId) {
    this.initializeRoom(roomId); // auto-init

    const room         = this.roomAnalytics.get(roomId);
    const contributions = this.getContributionPercentages(roomId);
    const activeSessions = room.sessions.filter(s => !s.leftAt).length;

    return {
      totalEdits:     room.totalEdits,
      activeUsers:    activeSessions,
      topContributor: contributions[0] || null,
      recentActivity: room.totalEdits > 0
    };
  }

  // ── Session summary ───────────────────────────────────────────────────────────
  generateSessionSummary(roomId) {
    this.initializeRoom(roomId);

    const room          = this.roomAnalytics.get(roomId);
    const contributions = this.getContributionPercentages(roomId);
    const ended         = room.sessions.filter(s => s.leftAt);
    const avgDuration   = ended.length
      ? ended.reduce((n, s) => n + s.duration, 0) / ended.length
      : 0;

    return {
      roomId,
      duration:               Date.now() - room.createdAt,
      totalEdits:             room.totalEdits,
      totalCharactersTyped:   room.totalCharactersTyped,
      totalCollaborators:     contributions.length,
      mostActiveCollaborator: this.getMostActiveCollaborator(roomId),
      contributions,
      averageSessionDuration: Math.round(avgDuration / 1000),
      totalSessions:          room.sessions.length
    };
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────
  clearRoomAnalytics(roomId) {
    this.roomAnalytics.delete(roomId);
    this.userContributions.delete(roomId);
  }

  getSystemStats() {
    let totalEdits = 0, totalCharacters = 0;
    this.roomAnalytics.forEach(r => {
      totalEdits      += r.totalEdits;
      totalCharacters += r.totalCharactersTyped;
    });
    return {
      totalRooms: this.roomAnalytics.size,
      totalEdits, totalCharacters, timestamp: Date.now()
    };
  }
}

module.exports = new AnalyticsManager();