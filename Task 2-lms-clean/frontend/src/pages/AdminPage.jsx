import { useState, useEffect } from 'react';
import { bookService, issueService } from '../services/api';

const EMPTY_BOOK = { title: '', author: '', ISBN: '', genre: '', description: '', quantity: 1, publishedYear: '' };

export default function AdminPage() {
  const [tab, setTab] = useState('books');
  const [books, setBooks] = useState([]);
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editBook, setEditBook] = useState(EMPTY_BOOK);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [issueFilter, setIssueFilter] = useState({ status: '', page: 1 });

  const showToast = (msg, type) => {
    setToast({ msg, type: type || 'success' });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    Promise.all([bookService.getAll({ limit: 100 }), issueService.getStats()])
      .then(([bRes, sRes]) => { setBooks(bRes.data.books); setStats(sRes.data.stats); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'issues') {
      issueService.getAllIssues(issueFilter).then(({ data }) => setIssues(data.records));
    }
  }, [tab, issueFilter]);

  const openAdd = () => { setEditBook(EMPTY_BOOK); setEditId(null); setModal('add'); };
  const openEdit = (b) => { setEditBook({ ...b }); setEditId(b._id); setModal('edit'); };
  const closeModal = () => setModal(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal === 'add') {
        const { data } = await bookService.create(editBook);
        setBooks((prev) => [data.book, ...prev]);
        showToast('Book added successfully!', 'success');
      } else {
        const { data } = await bookService.update(editId, editBook);
        setBooks((prev) => prev.map((b) => b._id === editId ? data.book : b));
        showToast('Book updated!', 'success');
      }
      closeModal();
    } catch (err) {
      showToast(err.response?.data?.message || 'Operation failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm('Remove "' + title + '" from catalogue?')) return;
    try {
      await bookService.delete(id);
      setBooks((prev) => prev.filter((b) => b._id !== id));
      showToast('Book removed.', 'success');
    } catch (e) {
      showToast('Delete failed.', 'error');
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="admin-page">
      {toast && <div className={'toast toast-' + toast.type}>{toast.msg}</div>}
      <div className="page-header"><h1>Admin Panel</h1><p>Manage your library</p></div>

      {stats && (
        <div className="stats-grid compact">
          {[
            { label: 'Books', value: stats.totalBooks, icon: '📚' },
            { label: 'Users', value: stats.totalUsers, icon: '👥' },
            { label: 'Active Loans', value: stats.totalIssued, icon: '📤' },
            { label: 'Overdue', value: stats.totalOverdue, icon: '⚠️' },
          ].map((s) => (
            <div key={s.label} className="stat-mini">
              <span>{s.icon}</span><strong>{s.value}</strong><span>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="tab-nav">
        <button className={tab === 'books' ? 'active' : ''} onClick={() => setTab('books')}>Books</button>
        <button className={tab === 'issues' ? 'active' : ''} onClick={() => setTab('issues')}>Issue Records</button>
      </div>

      {tab === 'books' && (
        <>
          <div className="section-toolbar">
            <span>{books.length} books</span>
            <button className="btn-primary" onClick={openAdd}>+ Add Book</button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Title</th><th>Author</th><th>ISBN</th><th>Genre</th><th>Qty</th><th>Available</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {books.map((b) => (
                  <tr key={b._id}>
                    <td><strong>{b.title}</strong></td>
                    <td>{b.author}</td>
                    <td className="mono">{b.ISBN}</td>
                    <td>{b.genre || '-'}</td>
                    <td>{b.quantity}</td>
                    <td><span className={'avail-badge ' + (b.availableCopies > 0 ? 'avail-yes' : 'avail-no')}>{b.availableCopies}</span></td>
                    <td>
                      <button className="btn-icon" onClick={() => openEdit(b)}>Edit</button>
                      <button className="btn-icon danger" onClick={() => handleDelete(b._id, b.title)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'issues' && (
        <>
          <div className="filter-bar">
            {['', 'issued', 'returned', 'overdue'].map((s) => (
              <button key={s} className={'tab-btn ' + (issueFilter.status === s ? 'active' : '')} onClick={() => setIssueFilter((f) => ({ ...f, status: s, page: 1 }))}>
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>User</th><th>Book</th><th>Issued</th><th>Due</th><th>Returned</th><th>Status</th><th>Fine</th></tr>
              </thead>
              <tbody>
                {issues.map((r) => (
                  <tr key={r._id}>
                    <td>{r.user && r.user.name}<br /><small>{r.user && r.user.email}</small></td>
                    <td><strong>{r.book && r.book.title}</strong></td>
                    <td>{new Date(r.issueDate).toLocaleDateString()}</td>
                    <td>{new Date(r.dueDate).toLocaleDateString()}</td>
                    <td>{r.returnDate ? new Date(r.returnDate).toLocaleDateString() : '-'}</td>
                    <td><span className={'status-badge status-' + r.status}>{r.status}</span></td>
                    <td>{r.fine > 0 ? '$' + r.fine : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'add' ? 'Add New Book' : 'Edit Book'}</h3>
              <button className="modal-close" onClick={closeModal}>X</button>
            </div>
            <form onSubmit={handleSave} className="modal-form">
              {[
                { name: 'title', label: 'Title', required: true },
                { name: 'author', label: 'Author', required: true },
                { name: 'ISBN', label: 'ISBN', required: true },
                { name: 'genre', label: 'Genre' },
                { name: 'publishedYear', label: 'Published Year', type: 'number' },
              ].map(({ name, label, required, type }) => (
                <div className="form-group" key={name}>
                  <label>{label}{required ? ' *' : ''}</label>
                  <input type={type || 'text'} value={editBook[name] || ''} onChange={(e) => setEditBook((b) => ({ ...b, [name]: e.target.value }))} required={required} />
                </div>
              ))}
              <div className="form-group">
                <label>Quantity *</label>
                <input type="number" min="1" value={editBook.quantity} onChange={(e) => setEditBook((b) => ({ ...b, quantity: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={editBook.description || ''} rows={3} onChange={(e) => setEditBook((b) => ({ ...b, description: e.target.value }))} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? '...' : modal === 'add' ? 'Add Book' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
