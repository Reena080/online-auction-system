import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Countdown from '../components/Countdown';
import StatusBadge from '../components/StatusBadge';
import BidForm from '../components/BidForm';
import BidHistory from '../components/BidHistory';

const ITEM_ICONS = {
  'headphones': '🎧',
  'sony': '🎧',
  'iphone': '📱',
  'phone': '📱',
  'macbook': '💻',
  'laptop': '💻',
  'playstation': '🎮',
  'gaming': '🎮',
  'watch': '⌚',
  'rolex': '⏱️'
};

function getItemIcon(title = '') {
  const lower = title.toLowerCase();
  for (const [key, icon] of Object.entries(ITEM_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '💎';
}

export default function AuctionPage({ auctionId, setView, onBack }) {
  const { isAuthenticated } = useAuth();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchAuction = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await api.auction.get(auctionId);
      if (res.success && res.data) {
        setAuction(res.data);
        setError(null);
      }
    } catch (err) {
      if (!isBackground) {
        setError(err.message || 'Failed to load auction details.');
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [auctionId]);

  // Initial load or auctionId change
  useEffect(() => {
    fetchAuction(false);
  }, [fetchAuction, auctionId]);

  // Real-time polling every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAuction(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchAuction]);

  const handleBidSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
    fetchAuction(true);
  };

  const handleExpire = () => {
    fetchAuction(true);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
        <div className="pulse-dot" style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--accent-gold)' }}></div>
        <p style={{ marginTop: '1rem' }}>Loading auction details...</p>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
        <button className="back-btn" onClick={onBack} id="back-to-marketplace-btn">
          ← Back to All Auctions
        </button>
        <div className="alert alert-error">
          <span>⚠️</span>
          <span>{error || 'Auction item could not be found.'}</span>
        </div>
      </div>
    );
  }

  const isEnded = auction.status === 'ENDED' || new Date(auction.endTime) <= new Date();
  const icon = getItemIcon(auction.title);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Back to Marketplace Navigation */}
      <button className="back-btn" onClick={onBack} id="back-to-marketplace-btn">
        ← Back to All Auctions
      </button>

      {/* Item Spotlight Header Card */}
      <div className="card" style={{ marginBottom: '1.75rem', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <div className="item-icon-badge" style={{ width: '56px', height: '56px', fontSize: '2rem' }}>
              {icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                  {auction.title}
                </h1>
                <StatusBadge status={isEnded ? 'ENDED' : 'ACTIVE'} />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', maxWidth: '750px', lineHeight: 1.5 }}>
                {auction.description}
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right', minWidth: '180px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'block' }}>
              Auction ID
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              {auction.id}
            </span>
          </div>
        </div>

        {/* Winner Banner if Ended */}
        {isEnded && (
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1.25rem', 
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(0, 0, 0, 0.4))',
            border: '1px solid var(--accent-gold)', 
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.8rem' }}>🏆</span>
              <div>
                <div style={{ fontWeight: '800', color: 'var(--accent-gold)', fontSize: '1.1rem' }}>
                  Auction Ended · Final Result
                </div>
                <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  {auction.highestBidderName ? (
                    <>Winner: <strong>{auction.highestBidderName}</strong> with winning bid of <strong>₹{Number(auction.currentHighestBid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></>
                  ) : (
                    'No bids were placed on this item.'
                  )}
                </div>
              </div>
            </div>
            <div className="badge badge-ended" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
              OFFICIAL RESULT
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Bidding Panel + History Panel */}
      <div className="auction-grid">
        {/* Left Column: Price, Timer, and Bidding Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Metrics Card */}
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
              {/* Current Highest Bid */}
              <div style={{ background: 'var(--bg-input)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  Current Highest Bid
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--accent-gold)', marginTop: '0.2rem' }} id="current-highest-bid-display">
                  ₹{Number(auction.currentHighestBid || auction.highestBid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                {auction.highestBidderName && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Leader: <strong style={{ color: 'var(--text-primary)' }}>{auction.highestBidderName}</strong>
                  </div>
                )}
              </div>

              {/* Starting Price */}
              <div style={{ background: 'var(--bg-input)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  Starting Price
                </span>
                <div style={{ fontSize: '1.85rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  ₹{Number(auction.startingPrice || auction.startingBid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Floor Price
                </div>
              </div>
            </div>

            {/* Countdown Component */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <Countdown endTime={auction.endTime} onExpire={handleExpire} />
            </div>
          </div>

          {/* Bid Form Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Place Your Bid
            </h3>

            <BidForm
              auction={auction}
              onBidSuccess={handleBidSuccess}
              setView={setView}
            />
          </div>
        </div>

        {/* Right Column: Paginated Live Bid History */}
        <div>
          <BidHistory
            auctionId={auction.id}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>
    </div>
  );
}
