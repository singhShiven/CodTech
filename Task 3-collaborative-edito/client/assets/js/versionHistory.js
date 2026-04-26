/**
 * Version History Manager
 * Handles version timeline and restoration
 */

class VersionHistory {
    constructor() {
      this.versions = [];
      this.modal = null;
    }
  
    /**
     * Initialize version history
     */
    init() {
      this.modal = document.getElementById('version-modal');
      this.setupEventListeners();
    }
  
    /**
     * Setup event listeners
     */
    setupEventListeners() {
      // Version history button
      const showBtn = document.getElementById('show-versions');
      if (showBtn) {
        showBtn.addEventListener('click', () => this.showModal());
      }
  
      // Close modal
      const closeBtn = document.getElementById('close-version-modal');
      const cancelBtn = document.getElementById('cancel-version');
      
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeModal());
      }
      
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.closeModal());
      }
  
      // Close on backdrop click
      const backdrop = document.getElementById('version-modal-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) {
            this.closeModal();
          }
        });
      }
    }
  
    /**
     * Show modal
     */
    showModal() {
      const backdrop = document.getElementById('version-modal-backdrop');
      if (backdrop) {
        backdrop.classList.add('active');
      }
      
      // Request version history
      socketClient.emit('request-version-history');
    }
  
    /**
     * Close modal
     */
    closeModal() {
      const backdrop = document.getElementById('version-modal-backdrop');
      if (backdrop) {
        backdrop.classList.remove('active');
      }
    }
  
    /**
     * Update version list
     */
    updateVersionList(versions) {
      this.versions = versions;
      
      const container = document.getElementById('versions-list');
      if (!container) return;
  
      if (versions.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--color-text-muted);">
            <p>No version history available yet.</p>
            <p style="font-size: 12px; margin-top: 8px;">Auto-save creates versions every 10 seconds.</p>
          </div>
        `;
        return;
      }
  
      container.innerHTML = '';
  
      versions.reverse().forEach((version, index) => {
        const item = document.createElement('div');
        item.className = 'version-item';
        item.onclick = () => this.selectVersion(version);
        
        const timestamp = new Date(version.timestamp);
        const timeAgo = this.getTimeAgo(version.timestamp);
        
        item.innerHTML = `
          <div class="version-header">
            <div>
              <div class="version-time">${timestamp.toLocaleString()}</div>
              <div class="version-meta">
                ${timeAgo} • ${version.wordCount} words • by ${version.author}
              </div>
            </div>
            <span class="badge ${version.type === 'auto' ? 'badge-neutral' : 'badge-primary'}">
              ${version.type === 'auto' ? 'Auto-saved' : 'Manual'}
            </span>
          </div>
          ${version.changes ? `
            <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 8px;">
              ${version.changes.wordsAdded > 0 ? `+${version.changes.wordsAdded} words ` : ''}
              ${version.changes.wordsRemoved > 0 ? `-${version.changes.wordsRemoved} words` : ''}
            </div>
          ` : ''}
        `;
        
        container.appendChild(item);
      });
    }
  
    /**
     * Select version for preview
     */
    selectVersion(version) {
      // Highlight selected
      document.querySelectorAll('.version-item').forEach(item => {
        item.style.borderColor = 'var(--color-border)';
      });
      event.currentTarget.style.borderColor = 'var(--color-primary)';
      
      // Show restore button
      const restoreBtn = document.getElementById('restore-version-btn');
      if (restoreBtn) {
        restoreBtn.disabled = false;
        restoreBtn.onclick = () => this.restoreVersion(version.id);
      }
      
      // Show preview
      const preview = document.getElementById('version-preview');
      if (preview) {
        preview.innerHTML = `
          <div style="padding: 16px; background: var(--color-surface); border-radius: 8px; max-height: 200px; overflow-y: auto;">
            <strong style="color: var(--color-primary);">Preview:</strong>
            <pre style="white-space: pre-wrap; margin-top: 8px; font-size: 13px; line-height: 1.6;">${this.escapeHtml(version.content?.substring(0, 500) || 'No content preview available')}${version.content?.length > 500 ? '...' : ''}</pre>
          </div>
        `;
      }
    }
  
    /**
     * Restore version
     */
    restoreVersion(versionId) {
      if (confirm('Restore this version? Current changes will be replaced.')) {
        socketClient.emit('restore-version', { versionId });
        this.closeModal();
      }
    }
  
    /**
     * Get time ago string
     */
    getTimeAgo(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      
      const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
      };
      
      for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
          return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
      }
      
      return 'just now';
    }
  
    /**
     * Escape HTML
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  
    /**
     * Handle version restored
     */
    handleRestored() {
      uiManager.showNotification('Version restored successfully', 'success');
    }
  }
  
  // Export singleton
  const versionHistory = new VersionHistory();