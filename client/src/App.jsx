import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuctionListPage from './pages/AuctionListPage';
import AuctionPage from './pages/AuctionPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

function MainLayout() {
  const { isAuthenticated, loading, logout } = useAuth();
  const [view, setView] = useState(() => (localStorage.getItem('bellcorp_auction_token') ? 'marketplace' : 'login'));
  const [selectedAuctionId, setSelectedAuctionId] = useState(null);

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated && view === 'marketplace') {
        setView('login');
      } else if (isAuthenticated && (view === 'login' || view === 'register')) {
        setView('marketplace');
      }
    }
  }, [isAuthenticated, loading]);

  const handleLogout = () => {
    logout();
    setView('login');
  };

  const handleSelectAuction = (auctionId) => {
    setSelectedAuctionId(auctionId);
    setView('auction-detail');
  };

  const handleBackToMarketplace = () => {
    setView('marketplace');
  };

  return (
    <div className="app-layout">
      <Navbar currentView={view} setView={setView} onLogout={handleLogout} />

      <main className="main-content">
        {view === 'login' && <LoginPage setView={setView} />}
        {view === 'register' && <RegisterPage setView={setView} />}
        {view === 'marketplace' && <AuctionListPage onSelectAuction={handleSelectAuction} />}
        {view === 'auction-detail' && (
          <AuctionPage 
            auctionId={selectedAuctionId} 
            setView={setView} 
            onBack={handleBackToMarketplace} 
          />
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <p>Bellcorp Studio Online Auction System · Multi-Item Concurrency Protected by PostgreSQL <code>SELECT ... FOR UPDATE</code></p>
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
