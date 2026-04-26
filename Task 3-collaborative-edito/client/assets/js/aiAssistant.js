/**
 * aiAssistant.js - FIXED (client-side)
 *
 * CHANGES:
 * 1. showLoading() / showResult() no longer toggle 'hidden' class —
 *    instead they directly set display style (more reliable cross-browser).
 * 2. Guard added: warn if trying to use AI before joining a room.
 * 3. Consistent result container reference across all methods.
 * 4. insertResult() dispatches 'input' event so the socket picks up the change.
 */

class AIAssistant {
    constructor() {
      this.isProcessing = false;
      this.lastResult   = '';
      this.panel        = null;
      this.resultBox    = null;
    }
  
    init() {
      this.panel     = document.getElementById('ai-panel');
      this.resultBox = document.getElementById('ai-result');
      this._setupListeners();
    }
  
    _setupListeners() {
      document.getElementById('toggle-ai-panel')?.addEventListener('click', () => this.togglePanel());
      document.getElementById('close-ai-panel') ?.addEventListener('click', () => this.closePanel());
  
      document.getElementById('ai-rewrite')   ?.addEventListener('click', () => this.rewrite());
      document.getElementById('ai-summarize') ?.addEventListener('click', () => this.summarize());
      document.getElementById('ai-bullets')   ?.addEventListener('click', () => this.generateBulletPoints());
      document.getElementById('ai-conclusion')?.addEventListener('click', () => this.generateConclusion());
      document.getElementById('ai-formal')    ?.addEventListener('click', () => this.adjustTone('formal'));
      document.getElementById('ai-technical') ?.addEventListener('click', () => this.adjustTone('technical'));
      document.getElementById('ai-actions')   ?.addEventListener('click', () => this.extractActionItems());
    }
  
    // ── Panel ─────────────────────────────────────────────────────────────────────
    togglePanel() { this.panel?.classList.toggle('active'); }
    closePanel()  { this.panel?.classList.remove('active'); }
  
    // ── Text helpers ──────────────────────────────────────────────────────────────
    _getText() {
      const editor = document.getElementById('editor');
      if (!editor) return '';
      const sel = editor.value.substring(editor.selectionStart, editor.selectionEnd);
      return sel || editor.value;
    }
  
    _guardRoom() {
      if (!AppState || !AppState.currentRoom) {
        uiManager.showNotification('Join a room first before using AI features.', 'warning');
        return false;
      }
      return true;
    }
  
    _guardText(text) {
      if (!text.trim()) {
        uiManager.showNotification('Please type something first (or select text).', 'warning');
        return false;
      }
      return true;
    }
  
    // ── Loading / result display ──────────────────────────────────────────────────
    showLoading(message = 'Processing...') {
      if (!this.resultBox) return;
      this.resultBox.style.display = 'block';
      this.resultBox.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;color:var(--color-text-secondary);">
          <div class="spinner"></div>
          <span>${message}</span>
        </div>`;
      this.isProcessing = true;
      this._setButtons(true);
    }
  
    showResult(result) {
      this.lastResult = result;
      if (!this.resultBox) return;
      this.resultBox.style.display = 'block';
      this.resultBox.innerHTML = `
        <div style="margin-bottom:10px;font-weight:600;color:var(--color-primary);">AI Result:</div>
        <div style="white-space:pre-wrap;line-height:1.6;font-size:13px;">${this._escape(result)}</div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button class="btn btn-sm btn-primary" onclick="aiAssistant.insertResult()">
            Insert to Document
          </button>
          <button class="btn btn-sm btn-secondary" onclick="aiAssistant.copyResult()">
            Copy
          </button>
        </div>`;
      this.isProcessing = false;
      this._setButtons(false);
    }
  
    showError(message) {
      if (!this.resultBox) return;
      this.resultBox.style.display = 'block';
      this.resultBox.innerHTML = `
        <div style="color:var(--color-error);">
          <strong>Error:</strong> ${this._escape(message)}
        </div>`;
      this.isProcessing = false;
      this._setButtons(false);
    }
  
    _setButtons(disabled) {
      document.querySelectorAll('.ai-action-btn').forEach(b => { b.disabled = disabled; });
    }
  
    _escape(text) {
      const d = document.createElement('div');
      d.textContent = text;
      return d.innerHTML;
    }
  
    // ── Insert / copy ─────────────────────────────────────────────────────────────
    insertResult() {
      if (!this.lastResult) return;
      const editor = document.getElementById('editor');
      if (!editor) return;
      const start = editor.selectionStart;
      const end   = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + this.lastResult + editor.value.substring(end);
      editor.focus();
      editor.dispatchEvent(new Event('input')); // triggers socket emit
      uiManager.showNotification('AI result inserted into document.', 'success');
    }
  
    async copyResult() {
      if (!this.lastResult) return;
      try {
        await navigator.clipboard.writeText(this.lastResult);
        uiManager.showNotification('Copied to clipboard.', 'success');
      } catch {
        uiManager.showNotification('Copy failed. Please copy manually.', 'error');
      }
    }
  
    // ── AI actions ────────────────────────────────────────────────────────────────
    rewrite() {
      if (!this._guardRoom()) return;
      const text = this._getText();
      if (!this._guardText(text)) return;
      this.showLoading('Rewriting text...');
      socketClient.emit('ai-rewrite', { text });
    }
  
    summarize() {
      if (!this._guardRoom()) return;
      const text = this._getText();
      if (!this._guardText(text)) return;
      this.showLoading('Generating summary...');
      socketClient.emit('ai-summarize', { text });
    }
  
    generateBulletPoints() {
      if (!this._guardRoom()) return;
      const text = this._getText();
      if (!this._guardText(text)) return;
      this.showLoading('Generating bullet points...');
      socketClient.emit('ai-bullet-points', { text });
    }
  
    generateConclusion() {
      if (!this._guardRoom()) return;
      const text = this._getText();
      if (!this._guardText(text)) return;
      this.showLoading('Writing conclusion...');
      socketClient.emit('ai-conclusion', { text });
    }
  
    adjustTone(tone) {
      if (!this._guardRoom()) return;
      const text = this._getText();
      if (!this._guardText(text)) return;
      this.showLoading(`Adjusting tone to ${tone}...`);
      socketClient.emit('ai-adjust-tone', { text, tone });
    }
  
    extractActionItems() {
      if (!this._guardRoom()) return;
      const text = this._getText();
      if (!this._guardText(text)) return;
      this.showLoading('Extracting action items...');
      socketClient.emit('ai-action-items', { text });
    }
  
    // ── Handle responses (called from app.js) ─────────────────────────────────────
    handleResponse(result) { this.showResult(result); }
    handleError(error)     { this.showError(error?.message || 'AI service error.'); }
  }
  
  const aiAssistant = new AIAssistant();