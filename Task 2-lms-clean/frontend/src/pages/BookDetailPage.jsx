import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookService, issueService } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function BookDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type) => {
    setToast({ msg, type: type || 'success' });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    bookService.getById(id)
      .then(({ data }) => setBook(data.book))
      .catch(() => navigate('/books'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleIssue = async () => {
    setIssuing(true);
    try {
      await issueService.issue(book._id);
      showToast('Book borrowed successfully! Due in 14 days.', 'success');
      setBook((b) => ({ ...b, availableCopies: b.availableCopies - 1 }));
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not borrow book.', 'error');
    } finally {
      setIssuing(false);
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;
  if (!book) return null;

  const hue = book.title.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <div className="book-detail-page">
      {toast && <div className={'toast toast-' + toast.type}>{toast.msg}</div>}
      <button className="back-btn" onClick={() => navigate(-1)}>Back</button>
      <div className="book-detail-layout">
        <div className="book-detail-cover" style={{ background: 'linear-gradient(160deg, hsl(' + hue + ',55%,30%), hsl(' + ((hue + 50) % 360) + ',55%,20%))' }}>
          <span className="cover-letter">{book.title.charAt(0)}</span>
        </div>
        <div className="book-detail-info">
          <span className="genre-pill">{book.genre || 'General'}</span>
          <h1>{book.title}</h1>
          <p className="detail-author">by <strong>{book.author}</strong></p>
          {book.publishedYear && <p className="detail-meta">Published: {book.publishedYear}</p>}
          <p className="detail-meta">ISBN: <span className="mono">{book.ISBN}</span></p>
          {book.description && <p className="detail-desc">{book.description}</p>}
          <div className="availability-bar">
            <span className={'avail-badge large ' + (book.availableCopies > 0 ? 'avail-yes' : 'avail-no')}>
              {book.availableCopies > 0 ? book.availableCopies + ' of ' + book.quantity + ' copies available' : 'All copies currently borrowed'}
            </span>
          </div>
          {user ? (
            <button className="btn-primary large" disabled={book.availableCopies === 0 || issuing} onClick={handleIssue}>
              {issuing ? 'Processing...' : book.availableCopies > 0 ? 'Borrow This Book' : 'Unavailable'}
            </button>
          ) : (
            <p className="login-prompt"><a href="/login">Sign in</a> to borrow this book.</p>
          )}
        </div>
      </div>
    </div>
  );
}
