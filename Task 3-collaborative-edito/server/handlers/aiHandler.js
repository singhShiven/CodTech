/**
 * aiHandler.js - FIXED
 *
 * ROOT CAUSES FIXED:
 * 1. Original version accepted currentRoom and currentUser as plain values
 *    captured at init time (always null).
 *    FIX: Accept getCurrentRoom and getCurrentUser as GETTER FUNCTIONS.
 *    Every handler calls them fresh — always reflects post-join state.
 *
 * 2. Permission checks now use the live room from the getter.
 *
 * 3. Added a guard: if AI features are globally disabled, emit a
 *    clear error rather than silently doing nothing.
 */

const aiService         = require('../services/aiService');
const permissionManager = require('../managers/permissionManager');
const logger            = require('../utils/logger');

/**
 * @param {object}   io             - Socket.IO server instance
 * @param {object}   socket         - This connection's socket
 * @param {function} getCurrentRoom - () => string | null
 * @param {function} getCurrentUser - () => object | null
 */
function initializeAIHandlers(io, socket, getCurrentRoom, getCurrentUser) {

  // ── Shared guard ────────────────────────────────────────────────────────────
  function guard(eventName) {
    const room = getCurrentRoom();
    const user = getCurrentUser();
    console.log("🧠 GUARD CHECK:", { room, user });
    if (!room || !user) {
      logger.warn(`[AI] ${eventName}: socket ${socket.id} not in a room`);
      socket.emit('ai-error', { message: 'You are not in a room. Please join a room first.' });
      return null;
    }

    if (!permissionManager.hasPermission(room, socket.id, 'useAI')) {
      socket.emit('ai-error', { message: 'Your role does not have AI access.' });
      return null;
    }

    return { room, user };
  }

  // ── ai-rewrite ──────────────────────────────────────────────────────────────
  socket.on('ai-rewrite', async (data) => {
    const ctx = guard('ai-rewrite');
    if (!ctx) return;

    const text = (data?.text || '').trim();
    if (!text) { socket.emit('ai-error', { message: 'No text provided.' }); return; }

    try {
      logger.info(`[AI] rewrite requested by ${ctx.user.username} in ${ctx.room}`);
      const result = await aiService.rewriteText(text, socket.id);
      socket.emit('ai-rewrite-result', { original: text, rewritten: result, timestamp: Date.now() });
    } catch (err) {
      logger.error('[AI] rewrite error', err);
      socket.emit('ai-error', { message: err.message || 'AI service error.' });
    }
  });

  // ── ai-summarize ────────────────────────────────────────────────────────────
  socket.on('ai-summarize', async (data) => {
    const ctx = guard('ai-summarize');
    if (!ctx) return;

    const text = (data?.text || '').trim();
    if (!text) { socket.emit('ai-error', { message: 'No text provided.' }); return; }

    try {
      logger.info(`[AI] summarize requested by ${ctx.user.username} in ${ctx.room}`);
      const result = await aiService.summarizeDocument(text, socket.id);
      socket.emit('ai-summarize-result', { summary: result, timestamp: Date.now() });
    } catch (err) {
      logger.error('[AI] summarize error', err);
      socket.emit('ai-error', { message: err.message || 'AI service error.' });
    }
  });

  // ── ai-bullet-points ────────────────────────────────────────────────────────
  socket.on('ai-bullet-points', async (data) => {
    const ctx = guard('ai-bullet-points');
    if (!ctx) return;

    const text = (data?.text || '').trim();
    if (!text) { socket.emit('ai-error', { message: 'No text provided.' }); return; }

    try {
      const result = await aiService.generateBulletPoints(text, socket.id);
      socket.emit('ai-bullet-points-result', { bulletPoints: result, timestamp: Date.now() });
    } catch (err) {
      logger.error('[AI] bullet-points error', err);
      socket.emit('ai-error', { message: err.message || 'AI service error.' });
    }
  });

  // ── ai-conclusion ───────────────────────────────────────────────────────────
  socket.on('ai-conclusion', async (data) => {
    const ctx = guard('ai-conclusion');
    if (!ctx) return;

    const text = (data?.text || '').trim();
    if (!text) { socket.emit('ai-error', { message: 'No text provided.' }); return; }

    try {
      const result = await aiService.generateConclusion(text, socket.id);
      socket.emit('ai-conclusion-result', { conclusion: result, timestamp: Date.now() });
    } catch (err) {
      logger.error('[AI] conclusion error', err);
      socket.emit('ai-error', { message: err.message || 'AI service error.' });
    }
  });

  // ── ai-adjust-tone ──────────────────────────────────────────────────────────
  socket.on('ai-adjust-tone', async (data) => {
    const ctx = guard('ai-adjust-tone');
    if (!ctx) return;

    const text = (data?.text || '').trim();
    const tone = data?.tone;

    if (!text) { socket.emit('ai-error', { message: 'No text provided.' }); return; }
    if (!['formal', 'technical'].includes(tone)) {
      socket.emit('ai-error', { message: 'Invalid tone. Use "formal" or "technical".' });
      return;
    }

    try {
      const result = await aiService.adjustTone(text, tone, socket.id);
      socket.emit('ai-tone-result', { original: text, adjusted: result, tone, timestamp: Date.now() });
    } catch (err) {
      logger.error('[AI] tone error', err);
      socket.emit('ai-error', { message: err.message || 'AI service error.' });
    }
  });

  // ── ai-action-items ─────────────────────────────────────────────────────────
  socket.on('ai-action-items', async (data) => {
    const ctx = guard('ai-action-items');
    if (!ctx) return;

    const text = (data?.text || '').trim();
    if (!text) { socket.emit('ai-error', { message: 'No text provided.' }); return; }

    try {
      const result = await aiService.extractActionItems(text, socket.id);
      socket.emit('ai-action-items-result', { actionItems: result, timestamp: Date.now() });
    } catch (err) {
      logger.error('[AI] action-items error', err);
      socket.emit('ai-error', { message: err.message || 'AI service error.' });
    }
  });
// ── ai-chat ─────────────────────────────────────────────────
socket.on('ai-chat', async (data) => {
  console.log("🔥 AI CHAT HIT");
  const ctx = guard('ai-chat');
  if (!ctx) return;

  const message = (data?.message || '').trim();
  const documentText = (data?.document || '').trim();

  if (!message) {
    socket.emit('ai-error', { message: 'Message is empty.' });
    return;
  }

  try {
    console.log("📩 AI CHAT REQUEST:", message);
    const result = await aiService.chatWithDocument(message, documentText, socket.id);
    console.log("📩 AI CHAT REQUEST:", message);

    socket.emit('ai-chat-result', {
      
      reply: result,
      timestamp: Date.now()
      
    });

  } catch (err) {
    console.error("❌ AI CHAT ERROR:", err);
    logger.error('[AI] chat error', err);
    socket.emit('ai-error', { message: err.message || 'AI chat failed.' });
  }
});
  // ── get-analytics (document NLP analytics, not contribution stats) ──────────
  socket.on('get-analytics', (data) => {
    const ctx = guard('get-analytics');
    if (!ctx) return;

    const text = data?.text || '';

    try {
      const analytics = aiService.getDocumentAnalytics(text);
      socket.emit('analytics-result', analytics);
    } catch (err) {
      logger.error('[AI] get-analytics error', err);
      socket.emit('analytics-error', { message: 'Analytics calculation failed.' });
    }
  });
}

module.exports = { initializeAIHandlers };