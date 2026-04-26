import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lms_token');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('lms_token');
      localStorage.removeItem('lms_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  getMe:    ()     => api.get('/auth/me'),
};

export const bookService = {
  getAll:    (params)   => api.get('/books', { params }),
  getById:   (id)       => api.get('/books/' + id),
  getGenres: ()         => api.get('/books/genres'),
  create:    (data)     => api.post('/books', data),
  update:    (id, data) => api.put('/books/' + id, data),
  delete:    (id)       => api.delete('/books/' + id),
};

export const issueService = {
  issue:       (bookId) => api.post('/issue', { bookId }),
  return:      (id)     => api.post('/issue/return/' + id),
  getMyIssues: (params) => api.get('/issue/my', { params }),
  getAllIssues: (params) => api.get('/issue/all', { params }),
  getStats:    ()       => api.get('/issue/stats'),
};

export default api;
