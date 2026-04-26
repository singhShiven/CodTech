import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link';

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="brand-icon">📚</span>
        <span className="brand-text">LibraryOS</span>
      </Link>
      <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
        <span /><span /><span />
      </button>
      <div className={'nav-links ' + (menuOpen ? 'open' : '')}>
        {user ? (
          <>
            <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>
            <Link to="/books"     className={isActive('/books')}>Books</Link>
            <Link to="/my-books"  className={isActive('/my-books')}>My Books</Link>
            {isAdmin && <Link to="/admin" className={isActive('/admin')}>Admin</Link>}
            <div className="nav-user">
              <span className="user-name">{user.name}</span>
              <span className={'role-badge ' + (isAdmin ? 'admin' : 'user')}>
                {isAdmin ? 'Admin' : 'User'}
              </span>
              <button onClick={handleLogout} className="btn-logout">Sign Out</button>
            </div>
          </>
        ) : (
          <>
            <Link to="/login"    className={isActive('/login')}>Sign In</Link>
            <Link to="/register" className="btn-primary-sm">Get Started</Link>
          </>
        )}
      </div>
    </nav>
  );
}
