import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ currentView, setView, onLogout }) {
  const { user, isAuthenticated, logout } = useAuth();

  const handleBrandClick = () => {
    setView('auction');
  };

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      logout();
      setView('auction');
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="brand-logo" onClick={handleBrandClick}>
          <span>🏛️ Bellcorp Auctions</span>
          <span className="brand-badge">Live</span>
        </div>

        <div className="nav-actions">
          {isAuthenticated ? (
            <>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  try {
                    const { api } = await import('../services/api');
                    await api.auction.reset();
                    window.location.reload();
                  } catch (e) {
                    console.error(e);
                  }
                }}
                title="Restart fresh 3-5m demo auctions from NOW"
                id="reset-demo-btn"
                style={{ fontSize: '0.75rem', borderColor: 'var(--accent-gold)' }}
              >
                🔄 Reset Demo (3-5m)
              </button>
              <div className="user-profile-badge">
                <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span>{user.name}</span>
              </div>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={handleLogoutClick}
                id="logout-button"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button 
                className={`btn btn-sm ${currentView === 'login' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setView('login')}
                id="nav-login-button"
              >
                Login
              </button>
              <button 
                className={`btn btn-sm ${currentView === 'register' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setView('register')}
                id="nav-register-button"
              >
                Register
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
