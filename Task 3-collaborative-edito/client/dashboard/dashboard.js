if (!isAuthenticated()) location.replace('/auth/login.html');

const user = getUser();

const state = {
  docs: [],
  loading: false,
};

const els = {
  greeting:    document.getElementById('greeting'),
  docGrid:     document.getElementById('doc-grid'),
  emptyState:  document.getElementById('empty-state'),
  newDocBtn:   document.getElementById('new-doc-btn'),
  logoutBtn:   document.getElementById('logout-btn'),
  loadingEl:   document.getElementById('loading-state'),
  searchInput: document.getElementById('search-input'),
  toastArea:   document.getElementById('toast-area'),

  // ⭐ NEW
  resumeBanner: document.getElementById('resume-banner'),
  resumeText: document.getElementById('resume-text'),
  resumeBtn: document.getElementById('resume-btn'),
};
function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  els.toastArea.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function excerpt(content, max = 80) {
  const text = (content || '').trim();
  return text.length > max ? text.slice(0, max) + '…' : text || 'Empty document';
}
function smartPreview(content) {
  if (!content) return "Start writing something...";

  let text = content;

  // 🔥 STEP 1: Remove ALL HTML tags (even broken ones)
  text = text.replace(/<[^>]*>?/gm, "");

  // 🔥 STEP 2: Clean spaces
  text = text
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 🔥 STEP 3: Final check
  if (!text) return "Start writing something...";

  return text.length > 160
    ? text.slice(0, 160) + "..."
    : text;
}
function renderDocs(docs) {
  
  els.docGrid.innerHTML = '';
  const newCard = document.createElement('div');
newCard.className = 'document-card new-document';
newCard.innerHTML = `
  <div class="new-doc-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  </div>
  <span class="new-doc-text">New Document</span>
`;

newCard.addEventListener('click', handleNewDoc);

els.docGrid.appendChild(newCard);
  if (!docs.length) {
    els.emptyState.style.display = 'flex';
    return;
  }
  els.emptyState.style.display = 'none';
  const lastOpened = localStorage.getItem('lastOpenedRoom');
  docs.forEach((doc) => {
    console.log("FULL DOC 👉", doc); // 🔥 ADD THIS
    console.log("DOC CONTENT 👉", doc.content);
    console.log("TYPE 👉", typeof doc.content);
  
    const card = document.createElement('div');
    card.className = 'document-card';
    card.dataset.room = doc.roomId;   // 🔥 ADD THIS
if (doc.roomId === lastOpened) {
  card.classList.add('recent-doc');
}
    card.dataset.id = doc._id;

    card.innerHTML = `
    <div class="card-header">
      <div class="doc-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
        </svg>
      </div>
      <h3 class="card-title">${escDash(doc.title)}</h3>
    </div>
  
    <p class="card-preview">${escDash(smartPreview(doc.content))}</p>
  
    <div class="card-footer">
      <span class="card-meta">${formatDate(doc.updatedAt)}</span>
  
      <div class="card-actions">
        <button class="action-btn rename-btn" data-id="${doc._id}" data-title="${escDash(doc.title)}">
          ✏️
        </button>
        <button class="action-btn delete delete-btn" data-id="${doc._id}">
          🗑️
        </button>
      </div>
    </div>
  `;

    els.docGrid.appendChild(card);
  });
  
}

function escDash(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function openDoc(roomId) {
  localStorage.setItem('lastOpenedRoom', roomId);

  const token = localStorage.getItem('ss_token');
  const user  = localStorage.getItem('ss_user');

  // 🚨 IMPORTANT CHECK
  if (!token || !user) {
    alert("Session expired. Please login again.");
    window.location.href = "/login.html";
    return;
  }

  // ✅ NO NEED to send token in URL anymore
  location.href = `/workspace.html?room=${encodeURIComponent(roomId)}`;
}

async function loadDocs() {
  els.loadingEl.style.display = 'flex';
  els.docGrid.style.display   = 'none';

  try {
    state.docs = await fetchDocuments();
    // ⭐ RESUME LOGIC
const lastRoom = localStorage.getItem('lastOpenedRoom');

if (lastRoom && state.docs.length > 0) {
  const lastDoc = state.docs.find(d => d.roomId === lastRoom);

  if (lastDoc) {
    els.resumeBanner.style.display = 'flex';
    els.resumeText.textContent = `Continue working on "${lastDoc.title}"`;

    document.getElementById('resume-card').onclick = () => openDoc(lastRoom);
  }
}
    state.docs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    // 🔥 SMART AUTO LOGIC
    const params = new URLSearchParams(window.location.search);
    const autoOpen = params.get('auto') === 'true';

    if (autoOpen) {
      if (state.docs.length > 0) {
        openDoc(state.docs[0].roomId);
        return;
      } else {
        const doc = await createDocument('Untitled Document');
        openDoc(doc.roomId);
        return;
      }
    }

  } catch (err) {
    toast(err.message, 'error');
    state.docs = [];
  }

  els.loadingEl.style.display = 'none';
  els.docGrid.style.display   = 'grid';
  renderDocs(state.docs);
}

async function handleNewDoc() {

  try {
    const doc = await createDocument('Untitled Document');
    state.docs.unshift(doc);
    toast('Document created');
    renderDocs(state.docs);
    openDoc(doc.roomId);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
   
  }
}

async function handleDelete(id) {
  if (!confirm('Delete this document? This cannot be undone.')) return;
  try {
    await deleteDocument(id);
    state.docs = state.docs.filter((d) => d._id !== id);
    toast('Document deleted');
    renderDocs(state.docs);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function handleRename(id, currentTitle) {
  const newTitle = prompt('Rename document:', currentTitle);
  if (!newTitle || newTitle.trim() === currentTitle) return;
  try {
   
    const doc = state.docs.find((d) => d._id === id);
    if (doc) doc.title = newTitle.trim();
    toast('Renamed');
    renderDocs(state.docs);
  } catch (err) {
    toast(err.message, 'error');
  }
}

els.docGrid.addEventListener('click', (e) => {
  const deleteBtn = e.target.closest('.delete-btn');
  if (deleteBtn) {
    e.stopPropagation();
    handleDelete(deleteBtn.dataset.id);
    return;
  }

  const renameBtn = e.target.closest('.rename-btn');
  if (renameBtn) {
    e.stopPropagation();
    handleRename(renameBtn.dataset.id, renameBtn.dataset.title);
    return;
  }

  const card = e.target.closest('.document-card');
  if (card && card.dataset.room) {
    openDoc(card.dataset.room);
  }
});

if (els.newDocBtn) {
  els.newDocBtn.addEventListener('click', handleNewDoc);
}

els.logoutBtn.addEventListener('click', () => {
  clearSession();
  location.replace('/auth/login.html');
});

els.searchInput.addEventListener('input', () => {
  const q = els.searchInput.value.toLowerCase();
  const filtered = q
    ? state.docs.filter((d) => d.title.toLowerCase().includes(q))
    : state.docs;
  renderDocs(filtered);
});

els.greeting.textContent = `Good ${getGreeting()}, ${user?.username || 'there'} `;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
const themeToggle = document.getElementById("theme-toggle");

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");

  if (current === "dark") {
    document.documentElement.setAttribute("data-theme", "light");
    themeToggle.textContent = "🌙";
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggle.textContent = "☀️";
  }
});
const gridBtn = document.getElementById("grid-view");
const listBtn = document.getElementById("list-view");

gridBtn.onclick = () => {
  els.docGrid.classList.remove("list-view");
  gridBtn.classList.add("active");
  listBtn.classList.remove("active");
  localStorage.setItem("viewMode", "grid");
};

listBtn.onclick = () => {
  els.docGrid.classList.add("list-view");
  listBtn.classList.add("active");
  gridBtn.classList.remove("active");
  localStorage.setItem("viewMode", "list");
};

/* 🔥 LOAD SAVED MODE */
const savedView = localStorage.getItem("viewMode");
if (savedView === "list") {
  els.docGrid.classList.add("list-view");
  listBtn.classList.add("active");
  gridBtn.classList.remove("active");
}
loadDocs();
// 🔥 Auto refresh when user returns to tab
window.addEventListener('focus', () => {
  console.log("🔄 Refreshing docs on focus...");
  loadDocs();
});

// 🔥 Auto refresh when tab becomes visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    loadDocs();
  }
});