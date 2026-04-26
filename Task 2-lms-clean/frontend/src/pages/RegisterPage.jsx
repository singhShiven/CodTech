import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-content">
          <div className="auth-logo">📚</div>
          <h1>Join LibraryOS</h1>
          <p>Create your account to start borrowing books, track your reading history, and discover new titles.</p>
          <ul className="auth-features">
            <li>Borrow up to 5 books at once</li>
            <li>14-day loan periods</li>
            <li>Real-time availability tracking</li>
            <li>Personalised reading history</li>
          </ul>
        </div>
      </div>
      <div className="auth-form-panel">
        <div className="auth-form-container">
          <h2>Create account</h2>
          <p className="auth-subtitle">Join the library community</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">Full name</label>
              <input id="name" name="name" type="text" value={form.name} onChange={handleChange} placeholder="Jane Doe" required />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min. 6 characters" required />
            </div>
            <div className="form-group">
              <label htmlFor="confirm">Confirm password</label>
              <input id="confirm" name="confirm" type="password" value={form.confirm} onChange={handleChange} placeholder="Repeat password" required />
            </div>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? <span className="spinner-sm" /> : 'Create Account'}
            </button>
          </form>
          <p className="auth-switch">Already a member? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
