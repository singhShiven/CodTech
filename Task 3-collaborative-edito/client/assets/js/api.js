const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('ss_token');
}

function setSession(token, user) {
  localStorage.setItem('ss_token', token);
  localStorage.setItem('ss_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('ss_token');
  localStorage.removeItem('ss_user');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('ss_user'));
  } catch {
    return null;
  }
}

function isAuthenticated() {
  return !!getToken();
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  console.log("🌐 FETCH START:", `${API_BASE}${path}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  console.log("📡 RESPONSE STATUS:", res.status);

  const data = await res.json().catch(() => ({}));

  console.log("📦 RESPONSE DATA:", data);

  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
async function register(username, email, password) {
  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });

  const data = res.data || res;

  setSession(data.token, data.user);
  return data;
}
async function login(email, password) {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const data = res.data || res; // support both formats

  setSession(data.token, data.user);
  return data;
}

async function fetchDocuments() {
  const res = await apiFetch('/documents');
  return res.data;
}

async function createDocument(title = 'Untitled Document') {
  const res = await apiFetch('/documents', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  return res.data;
}

async function deleteDocument(id) {
  return apiFetch(`/documents/${id}`, { method: 'DELETE' });
}

async function updateDocumentTitle(id, title) {
  return apiFetch(`/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  });
}
