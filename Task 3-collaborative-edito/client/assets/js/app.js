/**
 * ═══════════════════════════════════════════════════════════════
 * SYNCSPACE AI - FRONTEND APPLICATION (FIXED)
 * ═══════════════════════════════════════════════════════════════
 *
 * FIXES APPLIED:
 * 1. user?.username safe access everywhere — no more "undefined joined"
 * 2. username.substring crash fixed — guarded with typeof check
 * 3. Tone events fixed: 'ai-formal-tone'/'ai-technical-tone'
 *    → corrected to 'ai-adjust-tone' with { text, tone } payload
 * 4. AI result extraction fixed for tone response (data.adjusted)
 * 5. ai-error socket event now handled — shows toast instead of silent fail
 * 6. AI chat now emits real 'ai-chat' socket event (not random mock responses)
 * 7. analytics: 'request-analytics' aligned — server emits 'analytics-update'
 * 8. Loading overlay removed from analytics (server responds fast)
 * 9. user-typing / cursor-update event names aligned with server
 * 10. AppState alias added so aiAssistant.js / analyticsUI.js guards work
 */

// ═══════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════
/**
 * AUTH BRIDGE — paste this block at the very top of app.js,
 * before the existing state declaration.
 *
 * What it does:
 *  1. Reads JWT token from localStorage (set by dashboard) or URL param
 *  2. Exposes getAuthToken() for use during socket connection
 *  3. Redirects to login if no token is found (optional — remove if you
 *     want the app to remain usable without auth during development)
 *
 * Nothing below this block is changed.
 */

(function initAuthBridge() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');

  if (urlToken) {
    localStorage.setItem('ss_token', urlToken);
    // Clean the token from the URL without reloading
    const clean = new URL(window.location.href);
    clean.searchParams.delete('token');
    window.history.replaceState({}, '', clean.toString());
  }
})();

function getAuthToken() {
  return localStorage.getItem('ss_token') || null;
}

/**
 * INTEGRATION POINT: In the existing joinRoom() function, change:
 *
 *   state.socket = io();
 *
 * to:
 *
 *   state.socket = io({ auth: { token: getAuthToken() } });
 *
 * That's the only change needed in existing code.
 * Everything else (socket events, editor logic, AI, demo mode) is untouched.
 */

let versionHistory = [];
const state = {
  socket: null,
  currentRoom: null,
  currentUser: null,
  users: new Map(),
  cursors: new Map(),
  typingTimeout: null,
  suggestionTimeout: null,
  lastAIResult: null,
  aiOperationType: null,
  selectedText: '',
  selectionStart: 0,
  selectionEnd: 0,
  heartbeatInterval: null,
  presenceInterval: null
};

// FIX #10: AppState alias — used by aiAssistant.js and analyticsUI.js guards
const AppState = state;
let savedSelection = null;
const emitTyping = debounce((isTyping) => {
  state.socket?.emit('user-typing', { isTyping });
}, 300);

const emitCursor = throttle((position) => {
  state.socket?.emit('cursor-update', { position });
}, 50);
const typingUsers = new Set();
// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  initializeApp();
  loadThemePreference();
  checkRoomFromURL();
  const homeBtn = document.getElementById('home-btn');

if (homeBtn) {
  homeBtn.addEventListener('click', () => {
    const confirmLeave = confirm('Leave workspace? Unsaved changes may be lost.');
    if (!confirmLeave) return;

    window.location.href = '/dashboard/dashboard.html';
  });
}
  const sidebar = document.querySelector('.sidebar-right');
  if (!sidebar) return;

  let isResizing = false;

  sidebar.addEventListener('mousedown', (e) => {
    if (e.offsetX < 10) {
      isResizing = true;
      document.body.style.cursor = 'ew-resize';
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const newWidth = window.innerWidth - e.clientX;

    const min = 260;
    const max = 600;

    if (newWidth >= min && newWidth <= max) {
      sidebar.style.width = newWidth + 'px';
    }
  });

  document.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.style.cursor = 'default';
  });
  // ═══════════════════════════════════════
// INVITE SYSTEM (RESTORED CLEAN)
// ═══════════════════════════════════════

const inviteBtn = document.querySelector('.invite-btn');
const modal = document.getElementById('invite-modal');
const closeBtn = document.getElementById('close-invite-modal');

const linkInput = document.getElementById('invite-link');
const copyBtn = document.getElementById('copy-invite-link');

const emailInput = document.getElementById('invite-email');
const roleSelect = document.getElementById('invite-role');
const sendBtn = document.getElementById('send-invite-btn');

// OPEN MODAL
inviteBtn?.addEventListener('click', () => {
  if (!state.currentRoom && !state._joining) {
    showToast('Join a room first', 'warning');
    return;
  }

  const link = `${window.location.origin}${window.location.pathname}?room=${state.currentRoom}`;
  if (linkInput) linkInput.value = link;

  modal?.classList.add('show');
});

// CLOSE MODAL
closeBtn?.addEventListener('click', () => {
  modal?.classList.remove('show');
});

modal?.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.remove('show');
});

// COPY LINK
copyBtn?.addEventListener('click', () => {
  if (!linkInput?.value) return;

  navigator.clipboard.writeText(linkInput.value)
    .then(() => showToast("Link copied!", "success"))
    .catch(() => showToast("Copy failed", "error"));
});

// SEND INVITE
sendBtn?.addEventListener('click', () => {
  const email = emailInput?.value.trim();
  const role = roleSelect?.value;

  if (!email) {
    showToast("Enter email", "warning");
    return;
  }

  state.socket?.emit("send-invite", {
    email,
    role,
    roomId: state.currentRoom,
    link: linkInput?.value
  });

  showToast(`Invite sent to ${email}`, "success");

  if (emailInput) emailInput.value = '';
});
});

function initializeApp() {
  setupLoginScreen();
  setupEditorScreen();
  setupAIToolbar();
  setupModals();
  //setupAIChat();
  setupThemeToggle();
  setupShareLink();
  setupLogout(); 
  setupFloatingAI();
  setupFloatingAIInput();  // ENHANCEMENT
}

// ═══════════════════════════════════════════════════════════════
// THEME MANAGEMENT
// ═══════════════════════════════════════════════════════════════

function loadThemePreference() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    updateThemeIcon();
  }
}

function setupThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle?.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
    showToast(isDark ? 'Dark mode enabled' : 'Light mode enabled', 'info');
  });
}

function updateThemeIcon() {
  const icon = document.querySelector('#theme-toggle i');
  if (!icon) return;
  const isDark = document.body.classList.contains('dark-theme');
  icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
}

// ═══════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };

  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close"><i class="fas fa-times"></i></button>
  `;

  container.appendChild(toast);
  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ═══════════════════════════════════════════════════════════════
// URL HANDLING (Shareable Links)
// ═══════════════════════════════════════════════════════════════

function checkRoomFromURL() {
  // 🔒 Always start from login screen
document.getElementById('login-screen')?.classList.add('active');
document.getElementById('editor-screen')?.classList.remove('active');
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');

  console.log("🔗 INVITE LINK OPENED");
  console.log("ROOM FROM URL:", roomId);

  if (!roomId) return;

  // ✅ Fill room automatically
  const input = document.getElementById('room-input');
  if (input) input.value = roomId;

  const user = JSON.parse(localStorage.getItem('ss_user') || '{}');
  const token = getAuthToken();

  console.log("TOKEN:", token);

  // ✅ ONLY auto-join if BOTH exist AND VALID
  if (token && user?.username && user.username !== "User") {
    console.log("✅ Auto joining (logged in user)");

    document.getElementById('login-screen')?.classList.remove('active');
    document.getElementById('editor-screen')?.classList.add('active');

    joinRoom(user.username, roomId);
  } else {
    // ✅ Normal invite flow
    console.log("🟡 Waiting for username input");

    document.getElementById('login-screen')?.classList.add('active');
    document.getElementById('editor-screen')?.classList.remove('active');

    showToast('Enter your name to join the room', 'info');
  }
}
function fallbackCopy(text) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;

    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    document.execCommand('copy');
    document.body.removeChild(textarea);

    showToast('Room link copied to clipboard!', 'success');
  } catch (err) {
    showToast('Copy failed. Please copy manually.', 'error');
  }
}
function setupShareLink() {
  document.getElementById('share-link-btn')?.addEventListener('click', () => {
    if (!state.currentRoom) return;
    
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(state.currentRoom)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => showToast('Room link copied to clipboard!', 'success'))
        .catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════

function setupLoginScreen() {
  const usernameInput = document.getElementById('username-input');
  const roomInput = document.getElementById('room-input');
  const joinBtn = document.getElementById('join-btn');

  usernameInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') roomInput?.focus();
  });

  roomInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinBtn?.click();
  });

  joinBtn?.addEventListener('click', () => {
    const username = usernameInput?.value.trim();
    const roomId = roomInput?.value.trim();
    
    console.log("JOIN PARAMS DEBUG:", { username, roomId });
    
    if (!username) {
      showToast('Please enter your name', 'warning');
      usernameInput?.focus();
      return;
    }
    
    if (username === roomId) {
      showToast('Username cannot be same as Room ID', 'error');
      usernameInput?.focus();
      return;
    }
    
    if (!roomId) {
      showToast('Please enter a room ID', 'warning');
      roomInput?.focus();
      return;
    }

    if (!username) {
      showToast('Please enter your name', 'warning');
      usernameInput?.focus();
      return;
    }
    if (!roomId) {
      showToast('Please enter a room ID', 'warning');
      roomInput?.focus();
      return;
    }

    joinRoom(username, roomId);
  });
}

function joinRoom(username, roomId) {
  if (state._joining) return;   // 🚫 prevent duplicate join
state._joining = true;
 
  state.currentUser = username;
  state.currentRoom = roomId;
  state._joinedOnce = false; // ✅ RESET FLAG

  // ✅ FIX: connect to correct backend
  state.socket = io(window.location.origin, {
    transports: ["websocket"],
    auth: {
      token: getAuthToken()   // 🔥 THIS IS THE KEY LINE
    }
  });

  // Bridge for sidebar modules (aiAssistant.js, analyticsUI.js, versionHistory.js)
  if (typeof socketClient !== 'undefined') {
    socketClient.socket = state.socket;
    socketClient.isConnected = true;
  }

  setupSocketListeners();

  // ✅ DEBUG: check emit
  console.log('🚀 Joining room:', { roomId, username });

  const user = JSON.parse(localStorage.getItem('ss_user') || '{}');

  state.socket.emit('join-room', {
    roomId,
    username,
    userId: user?._id
  });

  showLoading('Connecting to room...');
}

// ═══════════════════════════════════════════════════════════════
// ENHANCEMENT: LOGOUT / BACK TO LOGIN
// ═══════════════════════════════════════════════════════════════

function setupLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', () => {
    // Disconnect socket gracefully
    // ✅ CLEAR INTERVALS (FIX MEMORY LEAK)
if (state.heartbeatInterval) {
  clearInterval(state.heartbeatInterval);
  state.heartbeatInterval = null;
}

if (state.presenceInterval) {
  clearInterval(state.presenceInterval);
  state.presenceInterval = null;
}
    if (state.socket) {
      try { state.socket.disconnect(); } catch (_) {}
      state.socket = null;
    }

    // Reset state
    state.currentRoom  = null;
    state.currentUser  = null;
    state.users        = new Map();
    state.cursors      = new Map();
    state.lastAIResult = null;

    // Clear collaborative cursors DOM
    const cursorsContainer = document.getElementById('cursors-container');
    if (cursorsContainer) cursorsContainer.innerHTML = '';

    // Clear activity log and users list
    const activityLog = document.getElementById('activity-log');
    const usersList   = document.getElementById('users-list');
    if (activityLog) activityLog.innerHTML = '';
    if (usersList)   usersList.innerHTML   = '';

    // Clear editor
    const editor = document.getElementById('editor');
    const titleInput = document.getElementById('doc-title-input');
const saveStatus = document.getElementById('save-status');
let renameTimeout;

    if (editor) editor.innerHTML = '';

    // Clear chat messages except the initial AI greeting
    const aiBody = document.getElementById('ai-panel-body');
    if (aiBody) {
      aiBody.innerHTML = `
        <div class="ai-msg ai">
          👋 Hi! I’m your AI assistant. Ask me anything about your document.
        </div>
      `;
    }

    // Clear input fields
    const usernameInput = document.getElementById('username-input');
    const roomInput     = document.getElementById('room-input');
    if (usernameInput) usernameInput.value = '';
    if (roomInput)     roomInput.value     = '';

    // Reset demo button if it was disabled
    const demoBtn = document.getElementById('demo-mode-btn');
    if (demoBtn) {
      demoBtn.disabled    = false;
      demoBtn.textContent = '';
      demoBtn.innerHTML   = '⚡ Demo Mode<span class="demo-mode-subtitle">Instant preview — no setup needed</span>';
    }

    // Remove demo banner if present
    document.querySelector('.demo-banner')?.remove();

    // Hide AI chat panel
    const chatPanel = document.getElementById('ai-chat-panel');
    if (chatPanel) chatPanel.style.display = 'none';

    // Close any open modals
    document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));

    // Switch screens
    document.getElementById('editor-screen')?.classList.remove('active');
    document.getElementById('login-screen')?.classList.add('active');

    showToast('You left the workspace', 'info');
  });
}

// ═══════════════════════════════════════════════════════════════
// SOCKET.IO SETUP
// ═══════════════════════════════════════════════════════════════

function setupSocketListeners() {
  const socket = state.socket;
  // ✅ FLOATING AI CHAT RESPONSE
  socket.on('ai-chat-result', (data) => {
    const aiBody = document.getElementById("ai-panel-body");
    if (!aiBody) return;
  
    // ❌ remove typing
    document.getElementById("ai-typing")?.remove();
  
    const div = document.createElement("div");
    div.className = "ai-msg ai";
    div.textContent = data?.reply || "No response";
  
    aiBody.appendChild(div);
    aiBody.scrollTop = aiBody.scrollHeight;
  });
  socket.on('heartbeat-ack', () => {
    updateUserActivity(); // refresh self activity
  });
  socket.on('version-restored', (data) => {
    hideLoading();
  
    if (data?.success) {
      showToast('Version restored successfully', 'success');
  
      // Optional but recommended
      const slider = document.getElementById('version-slider');
      if (slider) slider.value = slider.max;
  
    } else {
      showToast('Failed to restore version', 'error');
    }
  });
  

  socket.on('connect', () => {
    updateConnectionStatus('connected');
  });
  socket.on('disconnect', () => {
    updateConnectionStatus('disconnected');
    state._joining = false;
    showToast('Disconnected from server', 'error');
  });
  socket.on('reconnecting', () => {
    updateConnectionStatus('reconnecting');
    showToast('Reconnecting...', 'warning');
  });
// ✅ REAL-TIME ACTIVITY SYNC
socket.on('activity-update', (data) => {
  if (!data) return;

  const username = data?.user?.username || 'Someone';
  const message = data?.message || `${username} did something`;

  addActivityLog(message, data.type || 'info');
});
socket.on('title-updated', ({ title }) => {
  const titleInput = document.getElementById('doc-title-input');

  if (titleInput) {
    titleInput.value = title;
  }
});
  // Room events
  socket.on('room-joined', (data) => {
    hideLoading();
  
    console.log("ROOM JOINED USERS:", data?.users);
  
    if (state._joinedOnce) return;
    state._joinedOnce = true;
  
    // ✅ PURE SYNC (NO addUser)
    state.users.clear();
  
    (data.users || []).forEach(user => {
      if (user?.userId && user?.username) {
        state.users.set(user.userId, {
          username: user.username,
          status: user.status || 'online',
          lastActive: Date.now()
        });
      }
    });
  
    // ✅ SINGLE UI UPDATE
    updateUsersList(data.users);
  
    switchToEditorScreen(data);
  
    addActivityLog('You joined the room', 'join');
    showToast(`Welcome to ${state.currentRoom}!`, 'success');
  });
  // FIX #1: user?.username — guard against undefined user object
  
  socket.on('user-joined', (data) => {
    const username = data?.user?.username || data?.username || 'Someone';
    const userId = data?.user?.userId || data?.userId;
  
    // 🚨 IGNORE SELF EVENT COMPLETELY
    if (userId === state.socket?.id) return;
  
    addUser(userId, username);
  
    // ✅ START INTERVALS ONLY ONCE
    if (!state.heartbeatInterval) {
      state.heartbeatInterval = setInterval(() => {
        if (state.socket && state.currentRoom) {
          state.socket.emit('heartbeat');
        }
      }, 5000);
    }
  
    if (!state.presenceInterval) {
      state.presenceInterval = setInterval(() => {
        const now = Date.now();
  
        state.users.forEach((user) => {
          if (!user.lastActive || now - user.lastActive > 10000) {
            user.status = 'idle';
          }
        });
  
        updateUsersList(
          Array.from(state.users.entries()).map(([id, d]) => ({
            userId: id,
            username: d.username,
            status: d.status
          }))
        );
      }, 3000);
    }
  
    // ✅ ONLY log if NOT self
    if (userId !== state.socket?.id) {
    
      showToast(`${username} joined the room`, 'info');
    }
  });

  socket.on('user-left', (data) => {
    const username = data?.user?.username || data?.username || 'Someone';
    const userId = data?.user?.userId || data?.userId;
    const user = state.users.get(userId);
if (user) user.status = 'offline';
    removeUser(userId);
    removeCursor(userId);
   
    showToast(`${username} left the room`, 'info');
  });

  socket.on('users-update', (data) => {
    console.log("🔥 USERS UPDATE RECEIVED:", data);
  
    if (!data?.users) return;
  
    state.users.clear();
  
    data.users.forEach(user => {
      if (user?.userId && user?.username) {
        state.users.set(user.userId, {
          username: user.username,
          status: user.status || 'online',
          lastActive: Date.now()
        });
      }
    });
  
    updateUsersList(data.users);
  });


  // Content events
  socket.on('content-update', (data) => {
    hideLoading();
  
    updateEditorContent(
      data?.content,
      data?.updatedBy?.userId,
      data?.isRestore || false   // ✅ THIS LINE IS CRITICAL
    );
  });

  // FIX #9: server emits 'user-typing', not 'typing-start'/'typing-stop'
  socket.on('user-typing', (data) => {
    const username = data?.user?.username || 'Someone';
  
    if (data.isTyping) {
      typingUsers.add(username);
    } else {
      typingUsers.delete(username);
    }
  
    updateTypingUI();
  });
  function updateTypingUI() {
    const el = document.getElementById('typing-indicator');
    if (!el) return;
  
    if (typingUsers.size === 0) {
      el.textContent = '';
    } else {
      el.textContent = `${Array.from(typingUsers).join(', ')} typing...`;
    }
  }

  // FIX #9: server emits 'cursor-update', not 'cursor-position'
  socket.on('cursor-update', (data) => {
    if (data?.user?.userId !== socket.id) {
      updateCursor(data.user.userId, data.user.username, data.position);
    }
  });

  // ── AI events ────────────────────────────────────────────────
  socket.on('ai-rewrite-result',       (data) => handleAIResult(data, 'rewrite'));
  socket.on('ai-summarize-result',     (data) => handleAIResult(data, 'summarize'));
  socket.on('ai-bullet-points-result', (data) => handleAIResult(data, 'bulletPoints'));
  socket.on('ai-conclusion-result',    (data) => handleAIResult(data, 'conclusion'));
  // FIX #4: server returns 'ai-tone-result' (not 'ai-formal-tone-result')
  socket.on('ai-tone-result',          (data) => handleAIResult(data, 'tone'));
  socket.on('ai-action-items-result',  (data) => handleAIResult(data, 'actionItems'));

  // FIX #6: AI chat result from real socket
  /*socket.on('ai-chat-result', (data) => {
    addChatMessage(data?.reply || 'No response received.', 'assistant');
  });*/

  // FIX #5: ai-error now handled — was completely missing
  socket.on('ai-error', (data) => {
    hideLoading();
    showToast(data?.message || 'AI service error', 'error');
  });

  // FIX #7: Analytics — server emits 'analytics-update'
  socket.on('analytics-update', (data) => {
    hideLoading();
    displayAnalytics(data);
  });

  socket.on('analytics-result', (data) => {
    hideLoading();
    displayAnalytics(data);
  });

  // Version events
  socket.on('version-history', ({ versions }) => {
    versionHistory = versions || [];
    displayVersionHistory(versionHistory);
    const slider = document.getElementById('version-slider');
    if (!slider) return;
  
    slider.max = versionHistory.length - 1;
    slider.value = versionHistory.length - 1;
  });

  // General error
  socket.on('error', (data) => {
    hideLoading();
    state._joining = false;
    showToast(data?.message || 'An error occurred', 'error');
  });
}

// ═══════════════════════════════════════════════════════════════
// EDITOR SCREEN
// ═══════════════════════════════════════════════════════════════

function switchToEditorScreen(data) {
  document.getElementById('login-screen')?.classList.remove('active');
  document.getElementById('editor-screen')?.classList.add('active');

  const roomBadge = document.getElementById('room-badge');
  if (roomBadge) roomBadge.textContent = state.currentRoom;

  const editor = document.getElementById('editor');
  if (editor) {
    editor.innerHTML = data?.content || '';
    updateCharacterCount();
  }
  const titleInput = document.getElementById('doc-title-input');

  if (titleInput && data?.title) {
    titleInput.value = data.title;
  }
  if (data?.users) updateUsersList(data.users);
}

function setupEditorScreen() {
  const editor = document.getElementById('editor');
  
  if (!editor) return;
  const titleInput = document.getElementById('doc-title-input');
  const saveStatus = document.getElementById('save-status');
  document.querySelectorAll('.format-toolbar button').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.command;
      const value = btn.dataset.value || null;
      
      if (cmd === 'createLink') {
        const url = prompt("Enter URL:");
        if (url) formatText(cmd, url);
      } else {
        formatText(cmd, value);
      }
    });
  });
  let renameTimeout;
  let isRemoteTitleUpdate = false; // ✅ ADD THIS FLAG
  
  titleInput.addEventListener('input', () => {
    // 🚫 Prevent loop from socket update
    if (isRemoteTitleUpdate) return;
  
    saveStatus.textContent = 'Saving...';
  
    clearTimeout(renameTimeout);
  
    renameTimeout = setTimeout(async () => {
      try {
        await fetch(`/api/documents/by-room/${state.currentRoom}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAuthToken()}`
          },
          body: JSON.stringify({ title: titleInput.value })
        });
  
        // ✅ REAL-TIME SYNC
        state.socket?.emit('title-change', {
          roomId: state.currentRoom,
          title: titleInput.value
        });
  
        saveStatus.textContent = 'Saved';
  
        setTimeout(() => {
          if (saveStatus.textContent === 'Saved') {
            saveStatus.textContent = '';
          }
        }, 2000);
  
      } catch (err) {
        console.error(err);
        saveStatus.textContent = 'Error';
      }
    }, 800);
  });
  
  editor.addEventListener('input', () => {
    updateUserActivity();
    const content = editor.innerHTML;
    

    state.socket?.emit('content-change', {
      content,
      roomId: state.currentRoom   // 🔥 REQUIRED FIX
    });
    updateCharacterCount();
    scheduleAutoSave(content);
   // clear previous timeout
   clearTimeout(state.typingTimeout);

   // debounced typing start
   emitTyping(true);
   
   // delayed typing stop
   state.typingTimeout = setTimeout(() => {
     emitTyping(false);
   }, 1000);

    clearTimeout(state.suggestionTimeout);
    state.suggestionTimeout = setTimeout(() => {
      checkForAISuggestions(content);
    }, 800);
  });

  editor.addEventListener('click', updateCursorPosition);
  editor.addEventListener('keyup', updateCursorPosition);
  editor.addEventListener('select', updateCursorPosition);
  editor.addEventListener('mouseup', saveSelection);
editor.addEventListener('keyup', saveSelection);
const floatingToolbar = document.getElementById('floating-toolbar');

editor.addEventListener('mouseup', () => {
  setTimeout(() => {
    const selection = window.getSelection();
    const toolbar = document.getElementById('floating-toolbar');

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      toolbar.style.display = 'none';
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    toolbar.style.top = `${rect.top - 50 + window.scrollY}px`;
    toolbar.style.left = `${rect.left + window.scrollX}px`;
    toolbar.style.display = 'flex';
  }, 50); // 🔥 important delay
});
document.querySelectorAll('#floating-toolbar button').forEach(btn => {
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault(); // 🔥 prevents losing selection

    const cmd = btn.dataset.command;
    restoreSelection();
    formatText(cmd);
    saveSelection();
  });
});
document.addEventListener('click', (e) => {
  const toolbar = document.getElementById('floating-toolbar');
  if (!toolbar) return;

  if (!toolbar.contains(e.target)) {
    toolbar.style.display = 'none';
  }
});
}
let savedRange = null;

function saveSelection() {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    savedRange = selection.getRangeAt(0);
  }
}

function restoreSelection() {
  const selection = window.getSelection();
  if (savedRange) {
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }
}
function updateCursorPosition() {
  const editor = document.getElementById('editor');
  updateUserActivity();
  if (!editor) return;

  const position = window.getSelection()?.anchorOffset || 0;

  if (typeof position !== 'number') return; // safety

  emitCursor(position);
}

function updateEditorContent(content, userId, isRestore = false) {
  const editor = document.getElementById('editor');
  if (!editor || content === undefined) return;

  // ✅ allow update if:
  // - different user OR
  // - restore action
  if (editor.innerHTML !== content && (userId !== state.socket?.id || isRestore)) {
    editor.innerHTML = content;
    updateCharacterCount();
   }}

function updateCharacterCount() {
  const editor = document.getElementById('editor');
  if (!editor) return;
  const content = editor.innerText;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;
  const wEl = document.getElementById('word-count');
  const cEl = document.getElementById('char-count');
  if (wEl) wEl.textContent = `${words} word${words !== 1 ? 's' : ''}`;
  if (cEl) cEl.textContent = `${chars} character${chars !== 1 ? 's' : ''}`;
}

// ═══════════════════════════════════════════════════════════════
// COLLABORATIVE CURSORS
// ═══════════════════════════════════════════════════════════════

function updateCursor(userId, username, position) {
  const container = document.getElementById('cursors-container');
  const editor = document.getElementById('editor');
  if (!container || !editor) return;

  let cursor = state.cursors.get(userId);
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.className = 'cursor';
    // FIX #2: safe username access
    const safeName = (typeof username === 'string' && username) ? username : 'User';
    cursor.innerHTML = `<div class="cursor-label">${escapeHtml(safeName)}</div>`;
    container.appendChild(cursor);
    state.cursors.set(userId, cursor);
  }

  const textBeforeCursor = editor.innerText.substring(0, position);
  const lines = textBeforeCursor.split('\n');
  const lineNumber = lines.length - 1;
  const charInLine = lines[lines.length - 1].length;

  cursor.style.top = `${24 + lineNumber * 24}px`;
  cursor.style.transition = 'all 0.1s linear';
  cursor.style.left = `${24 + charInLine * 8}px`;
  cursor.style.background = getUserColor(userId);
}

function removeCursor(userId) {
  const cursor = state.cursors.get(userId);
  if (cursor) { cursor.remove(); state.cursors.delete(userId); }
}

function getUserColor(userId) {
  const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316'];
  let hash = 0;
  for (let i = 0; i < (userId || '').length; i++) {
    hash = (userId.charCodeAt(i) + ((hash << 5) - hash));
  }
  return colors[Math.abs(hash) % colors.length];
}

// ═══════════════════════════════════════════════════════════════
// AI TOOLBAR & OPERATIONS
// ═══════════════════════════════════════════════════════════════

function setupAIToolbar() {
  document.getElementById('ai-rewrite-btn')    ?.addEventListener('click', () => requestAI('rewrite'));
  document.getElementById('ai-summarize-btn')  ?.addEventListener('click', () => requestAI('summarize'));
  document.getElementById('ai-bullets-btn')    ?.addEventListener('click', () => requestAI('bulletPoints'));
  document.getElementById('ai-conclusion-btn') ?.addEventListener('click', () => requestAI('conclusion'));
  document.getElementById('export-pdf-btn')
  ?.addEventListener('click', exportPDF);
  document.getElementById('ai-action-items-btn')?.addEventListener('click', () => requestAI('actionItems'));


  setupToneDropdown();

  document.getElementById('analytics-btn')?.addEventListener('click', showAnalyticsModal);
  document.getElementById('versions-btn') ?.addEventListener('click', showVersionsModal);
}

function setupToneDropdown() {
  const dropdownBtn  = document.getElementById('tone-dropdown-btn');
  const dropdownMenu = document.getElementById('tone-menu');
  if (!dropdownBtn || !dropdownMenu) return;

  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => dropdownMenu.classList.remove('show'));

  dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      requestAI('tone', item.dataset.tone);
      dropdownMenu.classList.remove('show');
    });
  });
}

function requestAI(operation, tone = null) {
  if (!state.currentRoom && !state._joining) {
    showToast('Join a room first', 'warning');
    return;
  }

  const editor = document.getElementById('editor');
  if (!editor) return;
  
  // ✅ single source of truth
  let textToSend = editor.innerText;
  
  // ✅ since selection is removed (for now)
  state.selectedText = textToSend;
  
  state.aiOperationType = operation;



  if (operation === 'rewrite' && !state.selectedText) {
    showToast('Please select text to rewrite', 'warning');
    return;
  }

  if (['summarize','bulletPoints','conclusion','actionItems'].includes(operation)) {
    textToSend = editor.innerHTML;
    if (!textToSend.trim()) {
      showToast('Document is empty', 'warning');
      return;
    }
  }

  if (operation === 'tone') {
    textToSend = state.selectedText || editor.innerHTML;
    if (!textToSend.trim()) {
      showToast('Document is empty', 'warning');
      return;
    }
  }

  const loadingMessages = {
    rewrite:     '✨ Optimizing your text...',
    summarize:   '📝 Creating summary...',
    bulletPoints:'• Converting to bullets...',
    conclusion:  '🎯 Writing conclusion...',
    tone:        tone === 'formal' ? '👔 Applying formal tone...' : '💻 Applying technical tone...',
    actionItems: '✓ Extracting action items...'
  };

  showLoading(loadingMessages[operation] || 'AI is processing...');

  // FIX #3: Tone events fixed — server expects 'ai-adjust-tone' with {text, tone}
  const eventMap = {
    rewrite:     'ai-rewrite',
    summarize:   'ai-summarize',
    bulletPoints:'ai-bullet-points',
    conclusion:  'ai-conclusion',
    tone:        'ai-adjust-tone',      // ← was 'ai-formal-tone' / 'ai-technical-tone'
    actionItems: 'ai-action-items'
  };

  const payload = { text: textToSend };
  if (operation === 'tone') payload.tone = tone;   // ← include tone field

  state.socket?.emit(eventMap[operation], payload);
 
}

// ═══════════════════════════════════════════════════════════════
// AI RESULT HANDLING
// ═══════════════════════════════════════════════════════════════

function handleAIResult(data, operation) {
  hideLoading();

  if (data?.error) {
    showToast(data.error, 'error');
    return;
  }

  // FIX #4: Extract result including 'adjusted' (tone) field
  let aiResult = '';
  if (typeof data === 'string')      aiResult = data;
  else if (data.result)              aiResult = data.result;
  else if (data.rewritten)           aiResult = data.rewritten;
  else if (data.adjusted)            aiResult = data.adjusted;   // ← tone result
  else if (data.summary)             aiResult = data.summary;
  else if (data.bulletPoints)        aiResult = data.bulletPoints;
  else if (data.conclusion)          aiResult = data.conclusion;
  else if (data.actionItems)         aiResult = data.actionItems;
  else if (data.text)                aiResult = data.text;

  if (!aiResult) {
    showToast('No AI result received', 'error');
    return;
  }
  state.socket?.emit('activity-event', {
    type: 'ai',
    action: operation,
    message: `${state.currentUser} used AI ${operation}`
  });
  state.lastAIResult = aiResult;
  showAIPreviewModal(state.selectedText || 'Full document', aiResult, operation);
  showToast('AI result ready!', 'success');
}

// ═══════════════════════════════════════════════════════════════
// AI PREVIEW MODAL
// ═══════════════════════════════════════════════════════════════

function showAIPreviewModal(originalText, aiResult, operation) {
  const modal           = document.getElementById('ai-preview-modal');
  const modalTitle      = document.getElementById('modal-title');
  const previewOriginal = document.getElementById('preview-original');
  const previewResult   = document.getElementById('preview-result');
  if (!modal) return;

  const titles = {
    rewrite:     'AI Rewrite Result',
    summarize:   'AI Summary',
    bulletPoints:'Bullet Points',
    conclusion:  'Generated Conclusion',
    tone:        'Tone Adjusted',
    actionItems: 'Action Items'
  };

  if (modalTitle) modalTitle.textContent = titles[operation] || 'AI Result';
  if (previewOriginal) previewOriginal.textContent = originalText.length > 500 ? originalText.substring(0, 500) + '...' : originalText;
  if (previewResult)   previewResult.textContent   = aiResult;

  modal.classList.add('show');
}

function setupModals() {
  // AI Preview
  const aiPreviewModal = document.getElementById('ai-preview-modal');
  document.getElementById('close-modal-btn') ?.addEventListener('click', () => aiPreviewModal?.classList.remove('show'));
  document.getElementById('cancel-ai-btn')   ?.addEventListener('click', () => aiPreviewModal?.classList.remove('show'));
  document.getElementById('apply-ai-btn')    ?.addEventListener('click', () => { applyAIResult(); aiPreviewModal?.classList.remove('show'); });
  aiPreviewModal?.addEventListener('click', (e) => { if (e.target === aiPreviewModal) aiPreviewModal.classList.remove('show'); });

  // Analytics Modal
  const analyticsModal = document.getElementById('analytics-modal');
  document.getElementById('close-analytics-btn')?.addEventListener('click', () => analyticsModal?.classList.remove('show'));
  analyticsModal?.addEventListener('click', (e) => { if (e.target === analyticsModal) analyticsModal.classList.remove('show'); });

  // Versions Modal
  const versionsModal = document.getElementById('versions-modal');
  document.getElementById('close-versions-btn')?.addEventListener('click', () => versionsModal?.classList.remove('show'));
  versionsModal?.addEventListener('click', (e) => { if (e.target === versionsModal) versionsModal.classList.remove('show'); });
}
function formatAIText(text) {
  return text
    .split('\n')
    .map(line => {
      line = line.trim();

      if (!line) return '';

      // bullet detection
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return `<li>${line.substring(2)}</li>`;
      }

      return `<p>${line}</p>`;
    })
    .join('');
}
function applyAIResult() {
  if (!state.lastAIResult) return;

  const editor = document.getElementById('editor');
  if (!editor) return;

  // ✅ ALWAYS USE HTML
  const currentHTML = editor.innerHTML;

  // 🔥 Convert AI text → HTML
  const formatted = formatAIText(state.lastAIResult);

  let newContent = '';

  if (state.aiOperationType === 'rewrite') {
    newContent = formatted;
  } 
  else if (['summarize','bulletPoints','conclusion','actionItems','tone'].includes(state.aiOperationType)) {
    newContent = formatted;
  } 
  else {
    newContent = currentHTML + formatted;
  }

  // ✅ APPLY TO EDITOR
  editor.innerHTML = newContent;

  // ✅ SYNC TO ALL USERS
  state.socket?.emit('content-change', {
    content: newContent,
    roomId: state.currentRoom   // ✅ ADD THIS
  });

  updateCharacterCount();
  showToast('AI changes applied!', 'success');
}

// ═══════════════════════════════════════════════════════════════
// AI REAL-TIME SUGGESTIONS
// ═══════════════════════════════════════════════════════════════

function checkForAISuggestions(content) {
  if (!content.trim() || content.length < 50) { hideSuggestionBanner(); return; }
  const words = content.trim().split(/\s+/);
  if (words.length < 10) return;
  const lastChar = content.trim().slice(-1);
  if ('.!?'.includes(lastChar)) {
    const sentences = content.split(/[.!?]+/);
    const lastSentence = sentences[sentences.length - 2]?.trim();
    if (lastSentence && lastSentence.length > 20) generateAISuggestion(lastSentence);
  }
}

function generateAISuggestion(text) {
  const suggestions = [
    `Consider expanding on "${text.substring(0, 30)}..."`,
    'This sentence could be more concise',
    'Try adding supporting details here',
    'Consider breaking this into multiple sentences'
  ];
  showSuggestionBanner(suggestions[Math.floor(Math.random() * suggestions.length)]);
}

function showSuggestionBanner(suggestion) {
  const banner = document.getElementById('ai-suggestion-banner');
  const suggestionText = document.getElementById('suggestion-text');
  if (!banner || !suggestionText) return;
  suggestionText.textContent = suggestion;
  banner.style.display = 'flex';

  if (!banner.dataset.initialized) {
    document.getElementById('apply-suggestion-btn')?.addEventListener('click', () => {
      showToast('Suggestion applied (demo)', 'success');
      hideSuggestionBanner();
    });
    document.getElementById('ignore-suggestion-btn')?.addEventListener('click', hideSuggestionBanner);
    banner.dataset.initialized = 'true';
  }
}

function hideSuggestionBanner() {
  const banner = document.getElementById('ai-suggestion-banner');
  if (banner) banner.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════
// AI CHAT ASSISTANT (FIX #6 — uses real socket, not mock)
// ═══════════════════════════════════════════════════════════════

/*function setupAIChat() {
  const chatToggle = document.getElementById('ai-chat-toggle');
  const chatPanel  = document.getElementById('ai-chat-panel');
  const closeChat  = document.getElementById('close-chat-btn');
  const sendBtn    = document.getElementById('send-chat-btn');
  const chatInput  = document.getElementById('chat-input');

  chatToggle?.addEventListener('click', () => {
    if (!chatPanel) return;
    chatPanel.style.display = chatPanel.style.display === 'none' ? 'flex' : 'none';
  });

  closeChat?.addEventListener('click', () => {
    if (chatPanel) chatPanel.style.display = 'none';
  });

  sendBtn?.addEventListener('click', sendChatMessage);
  chatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });
}*/

/*function sendChatMessage() {
  const chatInput = document.getElementById('chat-input');
  const message = chatInput?.value.trim();
  if (!state._joinedOnce) {
    console.log("❌ Not joined yet");
    addChatMessage("Still connecting... try again in a second.", "assistant");
    return;
  }
  if (!message) return;

  addChatMessage(message, 'user');
  chatInput.value = '';

  if (!state.socket || !state.currentRoom) {
    // Not in a room yet — show friendly fallback
    setTimeout(() => addChatMessage('Please join a room first to use AI chat.', 'assistant'), 300);
    return;
  }

  // FIX #6: emit real socket event with document context
  const editor = document.getElementById('editor');
  state.socket.emit('ai-chat', {
    message,
    document: editor?.value || ''
  });

  // Show typing indicator in chat
  addChatTypingIndicator();
}*/

/*function addChatTypingIndicator() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const existing = container.querySelector('.chat-typing');
  if (existing) return;
  const div = document.createElement('div');
  div.className = 'chat-message chat-assistant chat-typing';
  div.innerHTML = `
    <div class="message-avatar"><i class="fas fa-robot"></i></div>
    <div class="message-content" style="display:flex;align-items:center;gap:6px;">
      <div class="spinner" style="width:14px;height:14px;border-width:2px;"></div>
      <span style="color:var(--text-tertiary);font-size:13px;">Thinking...</span>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}*/

/*function addChatMessage(message, sender) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  // Remove typing indicator
  container.querySelector('.chat-typing')?.remove();

  const div = document.createElement('div');
  div.className = `chat-message chat-${sender}`;

  // FIX #2: safe username — guard against undefined
  const userInitial = (typeof state.currentUser === 'string' && state.currentUser)
    ? state.currentUser.charAt(0).toUpperCase()
    : '?';
  const avatar = sender === 'user' ? userInitial : '<i class="fas fa-robot"></i>';

  div.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content"><p>${escapeHtml(message)}</p></div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}*/
function addChatMessage(message, sender) {
  const container = document.getElementById('ai-panel-body'); // ✅ NEW
  if (!container) return;

  const div = document.createElement('div');

  // ✅ NEW CLASS (matches new CSS)
  div.className = `ai-msg ${sender}`;

  // ✅ FIX WRAPPING
  div.style.whiteSpace = "pre-wrap";

  div.textContent = message;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
// ═══════════════════════════════════════════════════════════════
// ANALYTICS (FIX #7/#8)
// ═══════════════════════════════════════════════════════════════

function showAnalyticsModal() {
  const modal = document.getElementById('analytics-modal');
  modal?.classList.add('show');

  if (!state.socket || !state.currentRoom) {
    showToast('Join a room first to view analytics.', 'warning');
    return;
  }

  // FIX #8: No full loading overlay for analytics (too slow UX)
  // FIX #7: emit both events — server handles 'request-analytics', returns 'analytics-update'
  const editor = document.getElementById('editor');
  const text = editor?.innerText || '';
  if (text) state.socket.emit('get-analytics', { text });
  state.socket.emit('request-analytics');
}

function displayAnalytics(data) {
  if (!data) return;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? '--';
  };

  set('readability-score', data.readability?.score ?? data.wordCount ?? '--');
  set('readability-level', data.readability?.level ?? '--');

  const sentiment = data.sentiment?.score ?? 0;
  set('sentiment-score', sentiment > 0 ? `+${sentiment}` : sentiment);
  const sentLabel = data.sentiment?.sentiment || 'neutral';
  set('sentiment-label', sentLabel.charAt(0).toUpperCase() + sentLabel.slice(1));

  set('complexity-score', data.complexity?.score ?? '--');
  set('complexity-level', data.complexity?.level ?? '--');

  const passivePct   = data.passiveVoice?.percentage ?? 0;
  const passiveCount = data.passiveVoice?.count ?? 0;
  set('passive-percentage', `${passivePct}%`);
  set('passive-count', `${passiveCount} instance${passiveCount !== 1 ? 's' : ''}`);
}

// ═══════════════════════════════════════════════════════════════
// VERSION HISTORY
// ═══════════════════════════════════════════════════════════════

function showVersionsModal() {
  const modal = document.getElementById('versions-modal');
  modal?.classList.add('show');
  showLoading('Loading versions...');
  state.socket?.emit('request-version-history');
}

function displayVersionHistory(versions) {
  hideLoading();

  const list = document.getElementById('versions-list');
  if (!list) return;

  // ✅ HANDLE BOTH CASES (array OR {versions: []})
  if (!Array.isArray(versions)) {
    versions = versions?.versions || [];
  }

  if (!versions || versions.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-tertiary);padding:24px;">No versions available yet.</p>';
    return;
  }

  list.innerHTML = '';

  [...versions].reverse().forEach((version, index) => {
    const item = document.createElement('div');
    item.className = 'version-item';

    // ✅ FIX timestamp field mismatch
    const timestamp = new Date(version.createdAt || version.timestamp || Date.now());
    const timeAgo = getTimeAgo(timestamp);

    // ✅ FIX author mismatch
    const author = version.savedBy || version.author || 'Unknown';

    item.innerHTML = `
      <div class="version-header">
        <div class="version-meta">
          <strong>Version ${versions.length - index}</strong> · ${escapeHtml(author)}
        </div>
        <div class="version-time">${timeAgo}</div>
      </div>
      <div class="version-preview">
        ${escapeHtml((version.content || '').substring(0, 100) || 'Empty document')}...
      </div>
    `;

    // ✅ FIX id mismatch
    item.addEventListener('click', () =>
      restoreVersion(version.versionNumber || version.id)
    );

    list.appendChild(item);
  });
}

function restoreVersion(versionId) {
  if (!confirm('Restore this version? Current content will be replaced.')) return;
  showLoading('Restoring version...');
  state.socket?.emit('restore-version', { versionId });
  document.getElementById('versions-modal')?.classList.remove('show');
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  const intervals = { year:31536000, month:2592000, week:604800, day:86400, hour:3600, minute:60 };
  for (const [unit, s] of Object.entries(intervals)) {
    const n = Math.floor(seconds / s);
    if (n >= 1) return `${n} ${unit}${n !== 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

// ═══════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════
function updateUserActivity() {
  if (!state.socket?.id) return;

  const user = state.users.get(state.socket.id);
  if (user) {
    user.lastActive = Date.now();
    user.status = 'online';
  }
}
function addUser(userId, username) {
  if (!userId) return;

  state.users.set(userId, {
    username: username || 'User',
    status: 'online',
    lastActive: Date.now()
  });

  updateUsersList(
    Array.from(state.users.entries()).map(([id, d]) => ({
      userId: id,
      username: d.username,
      status: d.status
    }))
  );
}

function removeUser(userId) {
  if (!userId) return;
  state.users.delete(userId);
  updateUsersList(Array.from(state.users.entries()).map(([id, d]) => ({ userId: id, username: d.username })));
}

function updateUsersList(users) {
  const list = document.getElementById('users-list');
  if (!list) return;
  list.innerHTML = '';

  (users || []).forEach(user => {
    if (!user || !user.userId) return;

    const item = document.createElement('div');
    item.className = 'user-item';

    const isCurrentUser = user.userId === state.socket?.id;
    // FIX #2: safe username — guard substring crash
    const username = (typeof user.username === 'string' && user.username) ? user.username : 'User';
    const initials  = username.substring(0, 2).toUpperCase();
    const color     = getUserColor(user.userId);

    item.innerHTML = `
      <div class="user-avatar" style="background:${color}">${escapeHtml(initials)}</div>
      <div class="user-info">
      <div class="user-name">
      ${escapeHtml(username)}
      <span class="status-dot ${user.status || 'online'}"></span>
    </div>
        ${isCurrentUser ? '<span class="user-badge">You</span>' : ''}
      </div>
    `;
    list.appendChild(item);
  });
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════

function addActivityLog(message, type = 'info') {
  const log = document.getElementById('activity-log');
  if (!log) return;

  const item = document.createElement('div');
  item.className = `activity-item ${type}`;
  const time = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
  item.innerHTML = `${escapeHtml(message)}<span class="activity-time">${time}</span>`;
  log.appendChild(item);

  while (log.children.length > 50) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}

// ═══════════════════════════════════════════════════════════════
// CONNECTION STATUS
// ═══════════════════════════════════════════════════════════════

function updateConnectionStatus(status) {
  const el = document.getElementById('connection-status');
  if (!el) return;
  const text = el.querySelector('span');
  el.className = `connection-status ${status}`;
  const labels = { connected:'Connected', disconnected:'Disconnected', reconnecting:'Reconnecting...' };
  if (text) text.textContent = labels[status] || status;
}

// ═══════════════════════════════════════════════════════════════
// TYPING INDICATOR
// ═══════════════════════════════════════════════════════════════

function showTypingIndicator(username) {
  const el = document.getElementById('typing-indicator');
  if (el) el.textContent = `${username} is typing...`;
}

function hideTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.textContent = '';
}

// ═══════════════════════════════════════════════════════════════
// LOADING STATE
// ═══════════════════════════════════════════════════════════════

function showLoading(message = 'Loading...') {
  const overlay = document.getElementById('loading-overlay');
  const text    = document.getElementById('loading-text');
  if (text) text.textContent = message;
  if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = String(text ?? '');
  return d.innerHTML;
}
function saveSelection() {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    savedSelection = selection.getRangeAt(0);
  }
}

function restoreSelection() {
  if (!savedSelection) return;

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedSelection);
}

// ═══════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    showToast('Auto-save is always enabled', 'info');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    requestAI('rewrite');
  }
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
    document.querySelector('.dropdown-menu.show')?.classList.remove('show');
  }
});

// ═══════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
});

// ═══════════════════════════════════════════════════════════════
// DEMO MODE
// ═══════════════════════════════════════════════════════════════

const DEMO_CONFIG = {
  username : 'Demo User',
  roomId   : 'demo-room',
  content  : 'Welcome to SyncSpace AI. This is a real-time collaborative workspace with AI-powered writing assistance. Select any text and use the AI toolbar above to rewrite, summarize, or extract action items instantly.',
  delays: {
    afterJoin       : 1400,
    afterContent    : 1200,
    highlightOffset : 600,
    highlightDur    : 2800,
  },
};

function initDemoMode() {
  const btn = document.getElementById('demo-mode-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    btn.disabled = true;
    showDemoWelcome();
  });
}

async function runDemoMode() {
  const { username, roomId, content, delays } = DEMO_CONFIG;

  const usernameInput = document.getElementById('username-input') ||
                        document.querySelector('input[name="username"]') ||
                        document.querySelector('input[placeholder*="sername"]');
  const roomInput     = document.getElementById('room-input') ||
                        document.getElementById('room-id') ||
                        document.getElementById('roomId') ||
                        document.querySelector('input[name="roomId"]') ||
                        document.querySelector('input[placeholder*="oom"]');
  const joinBtn       = document.getElementById('join-btn') ||
                        document.querySelector('button[type="submit"]') ||
                        document.querySelector('.join-btn');

  if (usernameInput) usernameInput.value = username;
  if (roomInput)     roomInput.value     = roomId;

  if (joinBtn) {
    joinBtn.click();
  } else {
    state.socket?.emit('join-room', { roomId, username });
  }

  await sleep(delays.afterJoin);

  const editor = getEditor();
  if (editor) {
    editor.innerHTML !== undefined
      ? (editor.innerHTML = content)
      : (editor.textContent = content);

    editor.dispatchEvent(new Event('input',  { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));

    state.socket?.emit('content-change', { roomId, content });
  }

  insertDemoBanner();

  await sleep(delays.highlightOffset);
  highlightElement(getEditor(),      delays.highlightDur);

  await sleep(delays.highlightOffset);
  highlightElement(getAIToolbar(),   delays.highlightDur);

  await sleep(delays.highlightOffset);
  highlightElement(getUsersList(),   delays.highlightDur);

  await sleep(delays.afterContent);
  triggerDemoAI(roomId, content);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getEditor() {
  return document.getElementById('editor') ||
         document.getElementById('document-editor') ||
         document.querySelector('textarea.editor') ||
         document.querySelector('[contenteditable="true"]') ||
         document.querySelector('.editor-area textarea') ||
         document.querySelector('textarea');
}

function getAIToolbar() {
  return document.getElementById('ai-toolbar') ||
         document.querySelector('.ai-toolbar') ||
         document.querySelector('.toolbar');
}

function getUsersList() {
  return document.getElementById('users-list') ||
         document.getElementById('collaborators') ||
         document.querySelector('.users-list') ||
         document.querySelector('.collaborators-panel');
}

function highlightElement(el, durationMs = 2800) {
  if (!el) return;
  el.classList.add('demo-highlight');
  setTimeout(() => el.classList.remove('demo-highlight'), durationMs);
}

function insertDemoBanner() {
  if (document.querySelector('.demo-banner')) return;

  const banner = document.createElement('div');
  banner.className = 'demo-banner';
  banner.innerHTML = `
    <span class="demo-banner-dot"></span>
    <span>Demo Mode active — AI Summarize will run automatically on the sample text.</span>
  `;

  const editor     = getEditor();
  const insertRef  = editor ? (editor.closest('.editor-wrapper') || editor.parentElement) : null;
  const mainArea   = document.getElementById('main-content') ||
                     document.querySelector('.main-content') ||
                     document.querySelector('.editor-container') ||
                     insertRef;

  if (mainArea) {
    mainArea.insertBefore(banner, mainArea.firstChild);
  }
}

function triggerDemoAI(roomId, content) {
  if (!state.socket) return;

  const editor = getEditor();
  if (editor && editor.select) {
    editor.select();
  } else if (editor) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }

  state.socket.emit('ai-summarize', {
    roomId,
    content,
    selectedText: content,
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDemoMode);
} else {
  initDemoMode();
}

document.getElementById('version-slider')?.addEventListener('input', (e) => {
  const index = e.target.value;
  const version = versionHistory[index];

  if (!version) return;

  const editor = document.getElementById('editor');

  if (editor.innerHTML !== undefined) {
    editor.innerHTML = version.content;
  } else {
    editor.textContent = version.content;
  }

  document.getElementById('version-label').textContent =
  `Version ${version.id || version.versionNumber || index + 1}`;
});

// ═══════════════════════════════════════════════════════════════
// DEMO WELCOME SCREEN (DWS)
// ═══════════════════════════════════════════════════════════════

const DWS = (() => {

  const SLIDES = [
    { index: 0, lottie: 'https://assets10.lottiefiles.com/packages/lf20_jcikwtux.json', fallback: '🚀' },
    { index: 1, lottie: 'https://assets9.lottiefiles.com/packages/lf20_qdq2kely.json',  fallback: '👥' },
    { index: 2, lottie: 'https://assets4.lottiefiles.com/packages/lf20_fcfjwiyb.json',  fallback: '🤖' },
    { index: 3, lottie: 'https://assets2.lottiefiles.com/packages/lf20_sz9kbe5r.json',  fallback: '🕐' },
    { index: 4, lottie: 'https://assets3.lottiefiles.com/packages/lf20_qp1q7mct.json',  fallback: '📊' },
    { index: 5, lottie: 'https://assets5.lottiefiles.com/packages/lf20_v1yudlrx.json',  fallback: '✅' },
  ];

  const SLIDE_DURATION_MS = 2500;
  const TOTAL_SLIDES      = SLIDES.length;

  let currentSlide    = 0;
  let autoTimer       = null;
  let progressTimer   = null;
  let progressEl      = null;
  let progressStart   = 0;
  let lottieInstances = [];
  let isOpen          = false;

  function overlay()  { return document.getElementById('demo-welcome-screen'); }
  function dotsEl()   { return document.getElementById('dws-dots'); }
  function skipBtn()  { return document.getElementById('dws-skip-btn'); }
  function startBtn() { return document.getElementById('dws-start-btn'); }
  function slide(i)   { return document.querySelector(`.dws-slide[data-slide="${i}"]`); }

  // ── Mouse glow tracker ────────────────────────────────────────
  function bindMouseGlow() {
    const el = overlay();
    const glow = document.getElementById('dws-mouse-glow');
    if (!el || !glow) return;

    el._mouseMoveHandler = (e) => {
      const rect = el.getBoundingClientRect();
      glow.style.left = (e.clientX - rect.left) + 'px';
      glow.style.top  = (e.clientY - rect.top)  + 'px';
    };
    el.addEventListener('mousemove', el._mouseMoveHandler);
  }

  function unbindMouseGlow() {
    const el = overlay();
    if (el && el._mouseMoveHandler) {
      el.removeEventListener('mousemove', el._mouseMoveHandler);
    }
  }

  // ── Public: show ──────────────────────────────────────────────
  function show() {
    if (isOpen) return;
    isOpen = true;

    const el = overlay();
    if (!el) { startDemo(); return; }

    el.style.display = 'flex';
    el.classList.remove('dws-closing');

    currentSlide = 0;
    buildDots();
    buildProgressBar();
    bindControls();
    goToSlide(0, false);
    initLottie();
    scheduleNext();
    bindMouseGlow();
  }

  // ── Public: close + launch ────────────────────────────────────
  function startDemo() {
    close(() => {
      if (typeof runDemoMode === 'function') {
        const btn = document.getElementById('demo-mode-btn');
        if (btn) {
          btn.disabled    = true;
          btn.textContent = '⚡ Starting demo…';
        }
        runDemoMode();
      }
    });
  }

  function close(cb) {
    stop();
    unbindMouseGlow();
    const el = overlay();
    if (!el || !isOpen) { isOpen = false; cb && cb(); return; }

    el.classList.add('dws-closing');
    setTimeout(() => {
      el.style.display = 'none';
      el.classList.remove('dws-closing');
      isOpen = false;
      destroyLottie();
      cb && cb();
    }, 370);
  }

  // ── Dots ──────────────────────────────────────────────────────
  function buildDots() {
    const container = dotsEl();
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < TOTAL_SLIDES; i++) {
      const dot = document.createElement('button');
      dot.className = 'dws-dot' + (i === 0 ? ' dws-dot-active' : '');
      dot.setAttribute('aria-label', 'Slide ' + (i + 1));
      dot.addEventListener('click', () => { stop(); goToSlide(i); scheduleNext(); });
      container.appendChild(dot);
    }
  }

  function updateDots(idx) {
    const dots = dotsEl();
    if (!dots) return;
    Array.from(dots.children).forEach((d, i) => {
      d.classList.toggle('dws-dot-active', i === idx);
    });
  }

  // ── Progress bar ──────────────────────────────────────────────
  function buildProgressBar() {
    const el = overlay();
    if (!el) return;
    progressEl = el.querySelector('.dws-progress');
    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.className = 'dws-progress';
      el.appendChild(progressEl);
    }
    progressEl.style.width = '0%';
  }

  function startProgress() {
    if (!progressEl) return;
    progressStart = performance.now();
    cancelAnimationFrame(progressTimer);

    function tick(now) {
      const elapsed = now - progressStart;
      const pct     = Math.min((elapsed / SLIDE_DURATION_MS) * 100, 100);
      progressEl.style.width = pct + '%';
      if (pct < 100) progressTimer = requestAnimationFrame(tick);
    }
    progressTimer = requestAnimationFrame(tick);
  }

  // ── Slide transitions ─────────────────────────────────────────
  function goToSlide(idx, animate = true) {
    const prev = slide(currentSlide);
    const next = slide(idx);
    if (!next) return;

    if (prev && prev !== next && animate) {
      prev.classList.add('dws-exit');
      setTimeout(() => prev.classList.remove('dws-active', 'dws-exit'), 370);
    } else if (prev && prev !== next) {
      prev.classList.remove('dws-active', 'dws-exit');
    }

    currentSlide = idx;
    next.classList.add('dws-active');
    updateDots(idx);
    startProgress();

    const cta = startBtn();
    if (cta) cta.style.display = idx === TOTAL_SLIDES - 1 ? 'inline-block' : 'none';
  }

  function advance() {
    const next = currentSlide + 1;
    if (next >= TOTAL_SLIDES) { startDemo(); return; }
    goToSlide(next);
    scheduleNext();
  }

  function scheduleNext() {
    stop();
    autoTimer = setTimeout(advance, SLIDE_DURATION_MS);
  }

  function stop() {
    clearTimeout(autoTimer);
    cancelAnimationFrame(progressTimer);
    autoTimer = progressTimer = null;
  }

  // ── Controls ──────────────────────────────────────────────────
  function bindControls() {
    const skip  = skipBtn();
    const start = startBtn();

    if (skip) {
      const s2 = skip.cloneNode(true);
      skip.parentNode.replaceChild(s2, skip);
      s2.addEventListener('click', startDemo);
    }
    if (start) {
      const b2 = start.cloneNode(true);
      start.parentNode.replaceChild(b2, start);
      b2.addEventListener('click', startDemo);
      b2.style.display = 'none';
    }

    overlay()?.addEventListener('keydown', onKey, { once: false });
  }

  function onKey(e) {
    if (!isOpen) return;
    if (e.key === 'Escape')     { startDemo(); }
    if (e.key === 'ArrowRight') { stop(); advance(); }
    if (e.key === 'ArrowLeft' && currentSlide > 0) {
      stop(); goToSlide(currentSlide - 1); scheduleNext();
    }
  }

  // ── Lottie ────────────────────────────────────────────────────
  function initLottie() {
    if (typeof lottie === 'undefined') {
      SLIDES.forEach(({ index, fallback }) => {
        const c = document.getElementById('lottie-' + index);
        if (c) c.innerHTML = `<span class="dws-lottie-fallback">${fallback}</span>`;
      });
      return;
    }

    lottieInstances = [];

    SLIDES.forEach(({ index, lottie: path, fallback }) => {
      const c = document.getElementById('lottie-' + index);
      if (!c) return;
      try {
        const anim = lottie.loadAnimation({
          container: c, renderer: 'svg', loop: true, autoplay: true, path,
        });
        anim.addEventListener('data_failed', () => {
          c.innerHTML = `<span class="dws-lottie-fallback">${fallback}</span>`;
        });
        lottieInstances.push(anim);
      } catch (_) {
        c.innerHTML = `<span class="dws-lottie-fallback">${fallback}</span>`;
      }
    });
  }

  function destroyLottie() {
    lottieInstances.forEach(a => { try { a.destroy(); } catch (_) {} });
    lottieInstances = [];
  }

  return { show, startDemo };

})();

function showDemoWelcome()      { DWS.show(); }
function startDemoFromWelcome() { DWS.startDemo(); }
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
function throttle(func, limit) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      func.apply(this, args);
    }
  };
}
let autoSaveTimer = null;

function scheduleAutoSave(content) {
  if (!state.currentRoom) return;

  const saveStatus = document.getElementById('save-status');
  if (saveStatus) saveStatus.textContent = 'Saving...';

  clearTimeout(autoSaveTimer);

  autoSaveTimer = setTimeout(async () => {
    try {
      await fetch(`/api/documents/by-room/${state.currentRoom}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ content })
      });

      if (saveStatus) saveStatus.textContent = 'Saved';

    } catch (err) {
      console.error('Auto-save failed:', err);
      if (saveStatus) saveStatus.textContent = 'Error';
    }
  }, 1500); // slightly smoother UX
}
window.addEventListener('scroll', () => {
  const header = document.querySelector('.editor-header');

  if (window.scrollY > 10) {
    header.style.boxShadow = '0 8px 30px rgba(0,0,0,0.08)';
  } else {
    header.style.boxShadow = 'none';
  }
});
async function exportPDF() {
  const editor = document.getElementById('editor');
  if (!editor) return;

  const content = editor.innerText;

  const text = editor.innerText;

if (!text.trim()) {
    showToast('Document is empty', 'warning');
    return;
  }

  try {
    showLoading('Generating PDF...');

    const res = await fetch('/api/export/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });

    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.pdf';
    a.click();

    hideLoading();
    showToast('PDF downloaded!', 'success');

  } catch (err) {
    hideLoading();
    showToast('PDF export failed', 'error');
    console.error(err);
  }
}



function setupFloatingAIInput() {
  const aiInput = document.getElementById("ai-input");
  const aiBody = document.getElementById("ai-panel-body");
  const aiSend = document.getElementById("ai-send");

  if (!aiSend || !aiBody) return;

  // ✅ Prevent duplicate listener
  

  aiSend.addEventListener("click", () => {
    const text = aiInput?.value.trim();
    if (!text) return;
  
    const aiBody = document.getElementById("ai-panel-body");
  
    // ✅ USER MESSAGE
    const userMsg = document.createElement("div");
    userMsg.className = "ai-msg user";
    userMsg.textContent = text;
    aiBody.appendChild(userMsg);
  
    aiBody.scrollTop = aiBody.scrollHeight;
  
    state.socket.emit("ai-chat", {
      message: text,
      document: document.getElementById("editor")?.innerText || ""
    });
  
    aiInput.value = "";
  
    // ✅ SHOW TYPING
    showTyping();
  });
  function showTyping() {
    const aiBody = document.getElementById("ai-panel-body");
  
    const typing = document.createElement("div");
    typing.className = "ai-msg ai typing";
    typing.id = "ai-typing";
  
    typing.innerHTML = `
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    `;
  
    aiBody.appendChild(typing);
    aiBody.scrollTop = aiBody.scrollHeight;
  }

  aiInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      aiSend.click();
    }
  });
}
function setupFloatingAI() {
  const fab = document.getElementById("ai-fab");
  const panel = document.getElementById("ai-panel");

  if (!fab || !panel) return;

  fab.addEventListener("click", () => {
    panel.classList.toggle("show");
  });
}
document.addEventListener("click", (e) => {
  const panel = document.getElementById("ai-panel");
  const fab = document.getElementById("ai-fab");

  if (!panel || !fab) return;

  if (!panel.contains(e.target) && !fab.contains(e.target)) {
    panel.classList.remove("show");
  }
});


// Open modal

// Close modal


// Copy link


// Send invite

function formatText(command, value = null) {
  const editor = document.getElementById('editor');
  if (!editor) return;

  editor.focus();
  restoreSelection();

  // 🔥 HANDLE SPECIAL CASES
  if (command === 'createLink') {
    const url = prompt('Enter URL:');
    if (url) {
      document.execCommand('createLink', false, url);
    }
  } 
  else if (command === 'insertHTML') {
    document.execCommand('insertHTML', false, value || '<code></code>');
  } 
  else if (command === 'formatBlock') {
    document.execCommand('formatBlock', false, value || 'blockquote');
  } 
  else {
    document.execCommand(command, false, value);
  }

  saveSelection();
}
function addUserToUI(email) {
  const div = document.createElement('div');
  div.className = 'user-item';

  div.innerHTML = `
    <div class="user-avatar">${email[0].toUpperCase()}</div>
    <div class="user-info">
      <div class="user-name">${email}</div>
      <div class="user-badge">Online</div>
    </div>
  `;

  usersList.appendChild(div);
}