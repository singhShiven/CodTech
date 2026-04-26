/**
 * analyticsUI.js - FIXED (client-side)
 *
 * CHANGES:
 * 1. togglePanel now correctly shows/hides the analytics panel
 *    (the panel was display:none in HTML — added class toggle instead).
 * 2. requestAnalytics only fires when the editor has content AND
 *    we are actually in a room (AppState.currentRoom check).
 * 3. updateContributions handles empty array gracefully.
 * 4. All getElementById calls are guarded.
 */

class AnalyticsUI {
    constructor() {
      this.currentAnalytics = null;
      this.updateInterval   = null;
      this.panelVisible     = false;
    }
  
    init() {
      this.setupEventListeners();
    }
  
    setupEventListeners() {
      const toggleBtn  = document.getElementById('toggle-analytics');
      const refreshBtn = document.getElementById('refresh-analytics');
  
      if (toggleBtn)  toggleBtn.addEventListener('click',   () => this.togglePanel());
      if (refreshBtn) refreshBtn.addEventListener('click',  () => this.requestAnalytics());
    }
  
    // ── Panel visibility ──────────────────────────────────────────────────────────
    togglePanel() {
      const panel = document.getElementById('analytics-panel');
      if (!panel) return;
  
      this.panelVisible = !this.panelVisible;
      panel.style.display = this.panelVisible ? 'flex' : 'none';
  
      if (this.panelVisible) {
        this.requestAnalytics();
        this.startPeriodicUpdates();
      } else {
        this.stopPeriodicUpdates();
      }
    }
  
    // ── Periodic updates ──────────────────────────────────────────────────────────
    startPeriodicUpdates() {
      this.stopPeriodicUpdates(); // clear any existing
      this.updateInterval = setInterval(() => {
        this.requestAnalytics();
      }, 30000);
    }
  
    stopPeriodicUpdates() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
    }
  
    // ── Emit request ──────────────────────────────────────────────────────────────
    requestAnalytics() {
      // Guard: only emit if we are in a room
      if (!AppState || !AppState.currentRoom) return;
  
      const editor = document.getElementById('editor');
      const text   = editor ? editor.value : '';
  
      // NLP document analytics (local calculation via AI service)
      if (text) {
        socketClient.emit('get-analytics', { text });
      }
  
      // Contribution / real-time analytics (server-side)
      socketClient.emit('request-analytics');
    }
  
    // ── Update helpers ────────────────────────────────────────────────────────────
    _set(id, value) {
      const el = document.getElementById(id);
      if (el) el.textContent = value ?? '—';
    }
  
    updateAnalytics(data) {
      if (!data) return;
      this.currentAnalytics = data;
  
      this._set('analytics-words',     data.wordCount);
      this._set('analytics-chars',     data.characterCount);
      this._set('analytics-sentences', data.sentenceCount);
      this._set('analytics-paragraphs',data.paragraphCount);
      this._set('analytics-reading-time', `${data.estimatedReadingTime ?? 0} min`);
  
      if (data.readability) {
        this._set('readability-score', data.readability.score);
        this._set('readability-level', data.readability.level);
        this._updateBar('readability-bar', data.readability.score, false);
      }
  
      if (data.sentiment) {
        this._set('sentiment-score', data.sentiment.score);
        this._set('sentiment-label', data.sentiment.sentiment);
        this._set('sentiment-indicator', this._sentimentEmoji(data.sentiment.sentiment));
      }
  
      if (data.passiveVoice) {
        this._set('passive-count',      data.passiveVoice.count);
        this._set('passive-percentage', `${data.passiveVoice.percentage}%`);
      }
  
      if (data.complexity) {
        this._set('complexity-score', data.complexity.score);
        this._set('complexity-level', data.complexity.level);
        this._updateBar('complexity-bar', data.complexity.score, true);
      }
    }
  
    updateContributions(data) {
      const container = document.getElementById('contributions-list');
      if (!container) return;
  
      const contributions = data?.contributions || [];
  
      if (contributions.length === 0) {
        container.innerHTML = '<p style="color:var(--color-text-muted);font-size:13px;">No contributions yet.</p>';
        return;
      }
  
      container.innerHTML = '';
      contributions.forEach(c => {
        const item = document.createElement('div');
        item.style.marginBottom = '12px';
        item.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:24px;height:24px;border-radius:50%;background:${this._userColor(c.username)};
                          display:flex;align-items:center;justify-content:center;
                          color:#fff;font-size:11px;font-weight:700;">
                ${c.username.charAt(0).toUpperCase()}
              </div>
              <span style="font-size:13px;font-weight:500;">${c.username}</span>
            </div>
            <span style="font-weight:700;color:var(--color-primary);">${c.percentage}%</span>
          </div>
          <div class="contribution-bar">
            <div class="contribution-fill"
                 style="width:${c.percentage}%;background:${this._userColor(c.username)};"></div>
          </div>
          <div style="font-size:11px;color:var(--color-text-muted);margin-top:3px;">
            ${c.edits} edits &bull; ${c.charactersAdded} chars added
          </div>
        `;
        container.appendChild(item);
      });
  
      // Top contributor badge
      if (contributions.length > 0) {
        this._set('top-contributor', contributions[0].username);
      }
    }
  
    _updateBar(id, score, inverse) {
      const bar = document.getElementById(id);
      if (!bar) return;
      const pct = Math.min(100, Math.max(0, score));
      bar.style.width = `${pct}%`;
      if (inverse) {
        bar.style.background = pct < 30 ? 'var(--color-success)' : pct < 60 ? 'var(--color-warning)' : 'var(--color-error)';
      } else {
        bar.style.background = pct >= 70 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-error)';
      }
    }
  
    _sentimentEmoji(s) {
      return s === 'positive' ? '😊' : s === 'negative' ? '😟' : '😐';
    }
  
    _userColor(username) {
      const colors = ['#FF6B6B','#4ECDC4','#45B7D1','#FFA07A','#98D8C8','#F7DC6F','#BB8FCE','#85C1E2'];
      let hash = 0;
      for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colors[Math.abs(hash) % colors.length];
    }
  
    showSessionSummary(summary) {
      if (!summary) return;
      uiManager.showNotification(
        `Session: ${summary.totalEdits} edits by ${summary.totalCollaborators} collaborator(s).`,
        'info'
      );
    }
  }
  
  const analyticsUI = new AnalyticsUI();