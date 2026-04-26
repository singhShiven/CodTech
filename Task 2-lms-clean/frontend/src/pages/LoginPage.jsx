import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    const email = document.getElementById('lms-email').value;
    const password = document.getElementById('lms-password').value;
    const errDiv = document.getElementById('lms-error');
    const btn = document.getElementById('lms-btn');

    if (!email || !password) {
      errDiv.textContent = 'Please enter email and password.';
      errDiv.style.display = 'block';
      return;
    }

    btn.textContent = 'Signing in...';
    btn.disabled = true;
    errDiv.style.display = 'none';

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      errDiv.textContent = err.response?.data?.message || 'Login failed.';
      errDiv.style.display = 'block';
      btn.textContent = 'Sign In';
      btn.disabled = false;
    }
  };

  const fillAdmin = () => {
    document.getElementById('lms-email').value = 'admin@library.com';
    document.getElementById('lms-password').value = 'admin123';
  };

  const fillUser = () => {
    document.getElementById('lms-email').value = 'jane@example.com';
    document.getElementById('lms-password').value = 'user123';
  };

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-content">
          <div className="auth-logo">📚</div>
          <h1>LibraryOS</h1>
          <p>Your modern library management platform.</p>
          <div className="auth-stats">
            <div><strong>10,000+</strong><span>Books</span></div>
            <div><strong>500+</strong><span>Members</span></div>
            <div><strong>24/7</strong><span>Access</span></div>
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-container">
          <h2>Welcome back</h2>
          <p className="auth-subtitle">Sign in to your library account</p>

          <div
            id="lms-error"
            className="alert alert-error"
            style={{ display: 'none' }}
          />

          <div className="auth-form">
            <div className="form-group">
              <label>Email address</label>
              <input
                id="lms-email"
                type="email"
                placeholder="you@example.com"
                defaultValue=""
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                id="lms-password"
                type="password"
                placeholder="••••••••"
                defaultValue=""
              />
            </div>
            <button
              id="lms-btn"
              className="btn-submit"
              onClick={handleLogin}
            >
              Sign In
            </button>
          </div>

          <div className="demo-credentials">
            <p>Demo accounts — click to fill:</p>
            <div className="demo-btns">
              <button className="demo-btn" onClick={fillAdmin}>Admin</button>
              <button className="demo-btn" onClick={fillUser}>User</button>
            </div>
          </div>

          <p className="auth-switch">
            New to LibraryOS? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}