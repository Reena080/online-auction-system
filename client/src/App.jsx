import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuctionListPage from './pages/AuctionListPage';
import AuctionPage from './pages/AuctionPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

function MainLayout() {
  const { isAuthenticated, loading, logout } = useAuth();
  const [view, setView] = useState('auction');

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated && (view === 'login' || view === 'register')) {
        setView('auction');
      }
    }
  }, [isAuthenticated, loading]);

  const handleLogout = () => {
    logout();
    setView('auction');
  };

  return (
    <div className="app-layout">
      <Navbar currentView={view} setView={setView} onLogout={handleLogout} />

      <main className="main-content">
        {view === 'login' && <LoginPage setView={setView} />}
        {view === 'register' && <RegisterPage setView={setView} />}
        {view === 'auction' && <AuctionPage setView={setView} />}
      </main>

      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <p>Bellcorp Online Auction System · Protected by PostgreSQL <code>SELECT ... FOR UPDATE</code> Row-Level Locking</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

