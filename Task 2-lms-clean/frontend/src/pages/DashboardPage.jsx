import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { issueService, bookService } from '../services/api';

function stringToGradient(str) {
  const hue = str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return 'linear-gradient(135deg, hsl(' + hue + ',60%,35%), hsl(' + ((hue + 40) % 360) + ',60%,25%))';
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [myBooks, setMyBooks] = useState([]);
  const [recentBooks, setRecentBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [myRes, booksRes] = await Promise.all([
          issueService.getMyIssues({ limit: 5 }),
          bookService.getAll({ limit: 4, sort: '-createdAt' }),
        ]);
        setMyBooks(myRes.data.records);
        setRecentBooks(booksRes.data.books);
        if (isAdmin) {
          const statsRes = await issueService.getStats();
          setStats(statsRes.data.stats);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin]);

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  const statusColor = (s) => {
    if (s === 'issued') return 'status-issued';
    if (s === 'returned') return 'status-returned';
    if (s === 'overdue') return 'status-overdue';
    return '';
  };

  return (
    <div className="dashboard-page">
      <div className="dash-hero">
        <div className="dash-hero-text">
          <h1>Good day, {user.name.split(' ')[0]}</h1>
          <p>{isAdmin ? 'Library administration dashboard' : 'Track your borrowed books and discover new reads'}</p>
        </div>
        <Link to="/books" className="btn-primary">Browse Catalogue</Link>
      </div>

      {isAdmin && stats && (
        <div className="stats-grid">
          {[
            { label: 'Total Books', value: stats.totalBooks, icon: '📚', color: 'stat-blue' },
            { label: 'Registered Users', value: stats.totalUsers, icon: '👥', color: 'stat-green' },
            { label: 'Books Issued', value: stats.totalIssued, icon: '📤', color: 'stat-yellow' },
            { label: 'Overdue', value: stats.totalOverdue, icon: '⚠️', color: 'stat-red' },
          ].map((s) => (
            <div key={s.label} className={'stat-card ' + s.color}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="dash-grid">
        <section className="dash-section">
          <div className="section-header">
            <h2>My Borrowed Books</h2>
            <Link to="/my-books">View all</Link>
          </div>
          {myBooks.length === 0 ? (
            <div className="empty-state">
              <span>📖</span>
              <p>No books borrowed yet.</p>
              <Link to="/books" className="btn-primary-sm">Browse Books</Link>
            </div>
          ) : (
            <div className="issue-list">
              {myBooks.map((r) => (
                <div key={r._id} className="issue-item">
                  <div className="issue-info">
                    <strong>{r.book && r.book.title}</strong>
                    <span>{r.book && r.book.author}</span>
                  </div>
                  <div className="issue-meta">
                    <span className={'status-badge ' + statusColor(r.status)}>{r.status}</span>
                    <span className="due-date">Due: {new Date(r.dueDate).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="dash-section">
          <div className="section-header">
            <h2>Recently Added</h2>
            <Link to="/books">View catalogue</Link>
          </div>
          <div className="recent-books">
            {recentBooks.map((b) => (
              <Link key={b._id} to={'/books/' + b._id} className="recent-book-card">
                <div className="book-cover-mini" style={{ background: stringToGradient(b.title) }}>
                  {b.title.charAt(0)}
                </div>
                <div className="book-info-mini">
                  <strong>{b.title}</strong>
                  <span>{b.author}</span>
                  <span className={'avail ' + (b.availableCopies > 0 ? 'avail-yes' : 'avail-no')}>
                    {b.availableCopies > 0 ? b.availableCopies + ' available' : 'Unavailable'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {isAdmin && (
        <div className="admin-shortcuts">
          <h2>Admin Actions</h2>
          <div className="shortcut-grid">
            <Link to="/admin" className="shortcut-card">
              <span>📗</span><strong>Manage Books</strong><p>Add, edit, or remove books</p>
            </Link>
            <Link to="/admin" className="shortcut-card">
              <span>📋</span><strong>All Issues</strong><p>View all borrow records</p>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
