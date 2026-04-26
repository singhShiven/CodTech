import { useState, useEffect } from 'react';
import { issueService } from '../services/api';

export default function MyBooksPage() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState(null);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState({ status: '', page: 1, limit: 10 });

  const showToast = (msg, type) => {
    setToast({ msg, type: type || 'success' });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data } = await issueService.getMyIssues(filter);
      setRecords(data.records);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      showToast('Failed to load records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, [filter]); // eslint-disable-line

  const handleReturn = async (recordId) => {
    setReturning(recordId);
    try {
      const { data } = await issueService.return(recordId);
      const fineMsg = data.fine > 0 ? ' Fine: $' + data.fine : '';
      showToast('Book returned successfully!' + fineMsg, 'success');
      fetchRecords();
    } catch (err) {
      showToast(err.response?.data?.message || 'Return failed.', 'error');
    } finally {
      setReturning(null);
    }
  };

  const statusColor = (s) => {
    if (s === 'issued') return 'status-issued';
    if (s === 'returned') return 'status-returned';
    if (s === 'overdue') return 'status-overdue';
    return '';
  };

  return (
    <div className="mybooks-page">
      {toast && <div className={'toast toast-' + toast.type}>{toast.msg}</div>}
      <div className="page-header">
        <h1>My Borrowed Books</h1>
        <p>{total} records total</p>
      </div>
      <div className="filter-bar">
        {['', 'issued', 'returned', 'overdue'].map((s) => (
          <button key={s} className={'tab-btn ' + (filter.status === s ? 'active' : '')} onClick={() => setFilter((f) => ({ ...f, status: s, page: 1 }))}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="records-list">{[...Array(5)].map((_, i) => <div key={i} className="record-skeleton" />)}</div>
      ) : records.length === 0 ? (
        <div className="empty-state big"><span>📭</span><p>No records found.</p></div>
      ) : (
        <div className="records-list">
          {records.map((r) => (
            <div key={r._id} className="record-card">
              <div className="record-cover" style={{ background: 'hsl(' + (r.book && r.book.title ? r.book.title.charCodeAt(0) * 3 % 360 : 200) + ',50%,30%)' }}>
                {r.book && r.book.title ? r.book.title.charAt(0) : '?'}
              </div>
              <div className="record-info">
                <strong className="record-title">{r.book && r.book.title}</strong>
                <span className="record-author">{r.book && r.book.author}</span>
                <span className="record-isbn">ISBN: {r.book && r.book.ISBN}</span>
              </div>
              <div className="record-dates">
                <span>Issued: {new Date(r.issueDate).toLocaleDateString()}</span>
                <span>Due: {new Date(r.dueDate).toLocaleDateString()}</span>
                {r.returnDate && <span>Returned: {new Date(r.returnDate).toLocaleDateString()}</span>}
                {r.fine > 0 && <span className="fine">Fine: ${r.fine}</span>}
              </div>
              <div className="record-actions">
                <span className={'status-badge ' + statusColor(r.status)}>{r.status}</span>
                {r.status !== 'returned' && (
                  <button className="btn-return" disabled={returning === r._id} onClick={() => handleReturn(r._id)}>
                    {returning === r._id ? '...' : 'Return'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="pagination">
          <button disabled={filter.page <= 1} onClick={() => setFilter((f) => ({ ...f, page: f.page - 1 }))}>Prev</button>
          <span>Page {filter.page} of {pages}</span>
          <button disabled={filter.page >= pages} onClick={() => setFilter((f) => ({ ...f, page: f.page + 1 }))}>Next</button>
        </div>
      )}
    </div>
  );
}
