import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuctionPage from './pages/AuctionPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

export default function App() {
  const [view, setView] = useState('auction'); // 'auction' | 'login' | 'register'

  return (
    <AuthProvider>
      <div className="app-layout">
        <Navbar currentView={view} setView={setView} />

        <main className="main-content">
          {view === 'auction' && <AuctionPage setView={setView} />}
          {view === 'login' && <LoginPage setView={setView} />}
          {view === 'register' && <RegisterPage setView={setView} />}
        </main>

        <footer style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <p>Bellcorp Studio Online Auction System · Concurrency Protected by PostgreSQL <code>SELECT ... FOR UPDATE</code></p>
        </footer>
      </div>
    </AuthProvider>
  );
}
