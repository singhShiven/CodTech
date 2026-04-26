/**
 * UI Manager - UPDATED
 * Handles all UI updates and interactions
 */

class UIManager {
    constructor() {
      this.elements = {};
      this.state = {
        currentScreen: 'login',
        notifications: []
      };
    }
  
    /**
     * Initialize UI manager
     */
    init() {
      this.cacheElements();
      this.setupEventListeners();
    }
  
    /**
     * Cache DOM elements
     */
    cacheElements() {
      // Screens
      this.elements.loginScreen = document.getElementById('login-screen');
      this.elements.editorScreen = document.getElementById('editor-screen');
      
      // Login elements
      this.elements.usernameInput = document.getElementById('username');
      this.elements.roomIdInput = document.getElementById('room-id');
      this.elements.joinBtn = document.getElementById('join-btn');
      
      // Editor elements
      this.elements.editor = document.getElementById('editor');
      this.elements.currentRoom = document.getElementById('current-room');
      this.elements.userCount = document.getElementById('user-count');
      this.elements.usersList = document.getElementById('users-list');
      this.elements.activityLog = document.getElementById('activity-log');
      this.elements.typingIndicators = document.getElementById('typing-indicators');
      this.elements.leaveBtn = document.getElementById('leave-btn');
      
      // Status elements
      this.elements.connectionStatus = document.getElementById('connection-status');
      this.elements.charCount = document.getElementById('char-count');
      this.elements.wordCount = document.getElementById('word-count');
      
      // Other elements
      this.elements.notifications = document.getElementById('notifications');
    }
  
    /**
     * Setup event listeners for UI elements
     */
    setupEventListeners() {
      // Allow Enter key to join
      this.elements.roomIdInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.elements.joinBtn.click();
        }
      });
  
      this.elements.usernameInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.elements.roomIdInput.focus();
        }
      });
  
      // Export document
      const exportBtn = document.getElementById('export-doc');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => this.exportDocument());
      }
    }
  
    /**
     * Switch between screens
     */
    switchScreen(screenName) {
      this.elements.loginScreen?.classList.remove('active');
      this.elements.editorScreen?.classList.remove('active');
      
      if (screenName === 'login') {
        this.elements.loginScreen?.classList.add('active');
      } else if (screenName === 'editor') {
        this.elements.editorScreen?.classList.add('active');
      }
      
      this.state.currentScreen = screenName;
    }
  
    /**
     * Update connection status
     */
    updateConnectionStatus(status) {
      const statusEl = this.elements.connectionStatus;
      if (!statusEl) return;
      
      const dot = statusEl.querySelector('.status-dot');
      const text = statusEl.querySelector('.status-text');
      
      statusEl.className = 'status-indicator';
      
      switch (status) {
        case 'connected':
          statusEl.classList.add('connected');
          if (text) text.textContent = 'Connected';
          break;
        case 'disconnected':
          statusEl.classList.add('disconnected');
          if (text) text.textContent = 'Disconnected';
          break;
        case 'reconnecting':
          statusEl.classList.add('reconnecting');
          if (text) text.textContent = 'Reconnecting...';
          break;
      }
    }
  
    /**
     * Update user count
     */
    updateUserCount(count) {
      if (this.elements.userCount) {
        this.elements.userCount.textContent = `${count} ${count === 1 ? 'user' : 'users'}`;
      }
    }
  
    /**
     * Update users list
     */
    updateUsersList(users, currentSocketId) {
      if (!this.elements.usersList) return;
      
      this.elements.usersList.innerHTML = '';
      
      users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.style.backgroundColor = user.color;
        avatar.textContent = user.username.charAt(0).toUpperCase();
        
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        
        const name = document.createElement('div');
        name.className = 'user-name';
        name.textContent = user.username;
        
        const role = document.createElement('div');
        role.className = 'user-role';
        role.textContent = user.role || 'Editor';
        
        userInfo.appendChild(name);
        userInfo.appendChild(role);
        userItem.appendChild(avatar);
        userItem.appendChild(userInfo);
        
        // Add "You" badge for current user
        if (user.socketId === currentSocketId || user.userId === currentSocketId) {
          const badge = document.createElement('span');
          badge.className = 'badge badge-primary';
          badge.textContent = 'You';
          badge.style.marginLeft = 'auto';
          userItem.appendChild(badge);
        }
        
        this.elements.usersList.appendChild(userItem);
      });
    }
  
    /**
     * Add activity log entry
     */
    addActivityLog(message, type = 'info') {
      if (!this.elements.activityLog) return;
      
      const item = document.createElement('div');
      item.className = `activity-item ${type}`;
      
      const text = document.createElement('div');
      text.className = 'activity-text';
      text.textContent = message;
      
      const time = document.createElement('div');
      time.className = 'activity-time';
      time.textContent = new Date().toLocaleTimeString();
      
      item.appendChild(text);
      item.appendChild(time);
      
      this.elements.activityLog.insertBefore(item, this.elements.activityLog.firstChild);
      
      // Keep only last 100 entries
      while (this.elements.activityLog.children.length > 100) {
        this.elements.activityLog.removeChild(this.elements.activityLog.lastChild);
      }
    }
  
    /**
     * Update character and word count
     */
    updateCounts(content) {
      const charCount = content.length;
      const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
      
      if (this.elements.charCount) {
        this.elements.charCount.textContent = `${charCount} characters`;
      }
      
      if (this.elements.wordCount) {
        this.elements.wordCount.textContent = `${wordCount} words`;
      }
    }
  
    /**
     * Show notification
     */
    showNotification(message, type = 'info', duration = 4000) {
      if (!this.elements.notifications) return;
      
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      
      const content = document.createElement('div');
      content.className = 'notification-content';
      
      const messageEl = document.createElement('div');
      messageEl.className = 'notification-message';
      messageEl.textContent = message;
      
      content.appendChild(messageEl);
      notification.appendChild(content);
      
      this.elements.notifications.appendChild(notification);
      
      // Auto remove
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          notification.remove();
        }, 300);
      }, duration);
    }
  
    /**
     * Update typing indicators
     */
    updateTypingIndicator(userId, username, isTyping) {
      if (!this.elements.typingIndicators) return;
      
      const indicator = this.elements.typingIndicators.querySelector(`[data-user-id="${userId}"]`);
      
      if (isTyping) {
        if (!indicator) {
          const div = document.createElement('div');
          div.className = 'typing-indicator';
          div.setAttribute('data-user-id', userId);
          div.textContent = `${username} is typing...`;
          this.elements.typingIndicators.appendChild(div);
        }
      } else {
        if (indicator) {
          indicator.remove();
        }
      }
    }
  
    /**
     * Export document
     */
    exportDocument() {
      const content = this.elements.editor?.value || '';
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `syncspace-document-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showNotification('Document exported successfully', 'success');
    }
  
    /**
     * Reset editor screen
     */
    resetEditor() {
      if (this.elements.editor) this.elements.editor.value = '';
      if (this.elements.currentRoom) this.elements.currentRoom.textContent = '-';
      if (this.elements.usersList) this.elements.usersList.innerHTML = '';
      if (this.elements.activityLog) this.elements.activityLog.innerHTML = '';
      if (this.elements.typingIndicators) this.elements.typingIndicators.innerHTML = '';
      this.updateCounts('');
    }
  
    /**
     * Get input values
     */
    getLoginInputs() {
      return {
        username: this.elements.usernameInput?.value.trim() || '',
        roomId: this.elements.roomIdInput?.value.trim() || ''
      };
    }
  
    /**
     * Clear login inputs
     */
    clearLoginInputs() {
      if (this.elements.usernameInput) this.elements.usernameInput.value = '';
      if (this.elements.roomIdInput) this.elements.roomIdInput.value = '';
    }
  
    /**
     * Focus editor
     */
    focusEditor() {
      this.elements.editor?.focus();
    }
  
    /**
     * Update permissions UI
     */
    updatePermissionsUI(permissions) {
      // Disable editor if no write permission
      if (this.elements.editor) {
        this.elements.editor.readOnly = !permissions.permissions.write;
        
        if (!permissions.permissions.write) {
          this.elements.editor.placeholder = 'Read-only mode. You can only view this document.';
        }
      }
  
      // Show/hide AI features based on permission
      const aiToggle = document.getElementById('toggle-ai-panel');
      if (aiToggle) {
        aiToggle.style.display = permissions.permissions.useAI ? 'flex' : 'none';
      }
    }
  }
  
  // Export singleton instance
  const uiManager = new UIManager();