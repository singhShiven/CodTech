import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { bookService, issueService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

function stringToGradient(str) {
  const hue = str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return 'linear-gradient(160deg, hsl(' + hue + ',55%,30%), hsl(' + ((hue + 50) % 360) + ',55%,20%))';
}

function BookCard({ book, onIssue, issuing, isLoggedIn }) {
  return (
    <div className="book-card">
      <div className="book-cover" style={{ background: stringToGradient(book.title) }}>
        <span className="book-letter">{book.title.charAt(0)}</span>
        {book.genre && <span className="genre-tag">{book.genre}</span>}
      </div>
      <div className="book-body">
        <Link to={'/books/' + book._id} className="book-title">{book.title}</Link>
        <p className="book-author">{book.author}</p>
        {book.description && <p className="book-desc">{book.description.slice(0, 80)}...</p>}
        <div className="book-footer">
          <span className={'avail-badge ' + (book.availableCopies > 0 ? 'avail-yes' : 'avail-no')}>
            {book.availableCopies > 0 ? book.availableCopies + '/' + book.quantity + ' available' : 'Unavailable'}
          </span>
          {isLoggedIn && (
            <button className="btn-issue" disabled={book.availableCopies === 0 || issuing} onClick={() => onIssue(book._id)}>
              {issuing ? '...' : book.availableCopies > 0 ? 'Borrow' : 'Unavailable'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BooksPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [books, setBooks] = useState([]);
  const [genres, setGenres] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(null);
  const [toast, setToast] = useState(null);
  const [filters, setFilters] = useState({ search: '', genre: '', available: '', page: 1, limit: 12 });

  const showToast = (msg, type) => {
    setToast({ msg, type: type || 'success' });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await bookService.getAll(filters);
      setBooks(data.books);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      showToast('Failed to load books.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  useEffect(() => {
    bookService.getGenres().then(({ data }) => setGenres(data.genres));
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = ({ bookId, availableCopies }) => {
      setBooks((prev) => prev.map((b) => b._id === bookId ? { ...b, availableCopies } : b));
    };
    socket.on('book:availabilityChanged', handler);
    socket.on('book:created', fetchBooks);
    return () => {
      socket.off('book:availabilityChanged', handler);
      socket.off('book:created', fetchBooks);
    };
  }, [socket, fetchBooks]);

  const handleIssue = async (bookId) => {
    if (!user) return;
    setIssuing(bookId);
    try {
      await issueService.issue(bookId);
      showToast('Book issued! Due in 14 days.', 'success');
      fetchBooks();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not issue book.', 'error');
    } finally {
      setIssuing(null);
    }
  };

  const updateFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val, page: 1 }));

  return (
    <div className="books-page">
      {toast && <div className={'toast toast-' + toast.type}>{toast.msg}</div>}
      <div className="page-header">
        <h1>Book Catalogue</h1>
        <p>{total} books in our collection</p>
      </div>
      <div className="filter-bar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Search by title or author..." value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} className="search-input" />
        </div>
        <select value={filters.genre} onChange={(e) => updateFilter('genre', e.target.value)} className="filter-select">
          <option value="">All Genres</option>
          {genres.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={filters.available} onChange={(e) => updateFilter('available', e.target.value)} className="filter-select">
          <option value="">All Availability</option>
          <option value="true">Available Now</option>
        </select>
      </div>

      {loading ? (
        <div className="books-grid">
          {[...Array(8)].map((_, i) => <div key={i} className="book-skeleton" />)}
        </div>
      ) : books.length === 0 ? (
        <div className="empty-state big">
          <span>🔎</span>
          <p>No books found matching your search.</p>
          <button onClick={() => setFilters({ search: '', genre: '', available: '', page: 1, limit: 12 })} className="btn-primary-sm">Clear Filters</button>
        </div>
      ) : (
        <div className="books-grid">
          {books.map((book) => (
            <BookCard key={book._id} book={book} onIssue={handleIssue} issuing={issuing === book._id} isLoggedIn={!!user} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="pagination">
          <button disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>Prev</button>
          <span>Page {filters.page} of {pages}</span>
          <button disabled={filters.page >= pages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>Next</button>
        </div>
      )}
    </div>
  );
}
