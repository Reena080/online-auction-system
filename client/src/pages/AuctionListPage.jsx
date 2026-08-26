import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Countdown from '../components/Countdown';

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

export default function AuctionListPage({ onSelectAuction }) {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'ENDED'
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAuctions = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const params = {};
      if (filter !== 'ALL') params.status = filter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await api.auction.getAll(params);
      if (res.success) {
        setAuctions(res.data || []);
        setError(null);
      }
    } catch (err) {
      if (!isBackground) {
        setError(err.message || 'Failed to load auctions.');
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [filter, searchTerm]);

  // Initial fetch and on filter/search change
  useEffect(() => {
    fetchAuctions(false);
  }, [fetchAuctions]);

  // Background polling every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAuctions(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchAuctions]);

  const activeCount = auctions.filter(a => a.status === 'ACTIVE').length;
  const endedCount = auctions.filter(a => a.status === 'ENDED').length;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Marketplace Header */}
      <div className="marketplace-header">
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>🏛️</span> Live Auction Marketplace
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Discover and bid on exclusive, authenticated items protected by real-time concurrency locking.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="search-filter-bar" style={{ marginBottom: '1.75rem' }}>
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search items by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            id="marketplace-search-input"
          />
        </div>

        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
            id="filter-all-btn"
          >
            All Items ({auctions.length})
          </button>
          <button
            className={`filter-tab ${filter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setFilter('ACTIVE')}
            id="filter-active-btn"
          >
            🟢 Live Auctions ({activeCount})
          </button>
          <button
            className={`filter-tab ${filter === 'ENDED' ? 'active' : ''}`}
            onClick={() => setFilter('ENDED')}
            id="filter-ended-btn"
          >
            🔴 Ended ({endedCount})
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <div className="pulse-dot" style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--accent-gold)' }}></div>
          <p style={{ marginTop: '0.75rem' }}>Loading auction items...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && auctions.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span style={{ fontSize: '2.5rem' }}>🔍</span>
          <h3 style={{ marginTop: '1rem', color: 'var(--text-primary)' }}>No auction items found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Try adjusting your search terms or filter selection.
          </p>
        </div>
      )}

      {/* Auctions Grid */}
      {!loading && auctions.length > 0 && (
        <div className="auctions-grid">
          {auctions.map((item) => {
            const isEnded = item.status === 'ENDED' || new Date(item.endTime) <= new Date();
            const icon = getItemIcon(item.title);

            return (
              <div key={item.id} className="auction-card" id={`auction-card-${item.id}`}>
                <div>
                  <div className="card-top">
                    <div className="item-icon-badge">{icon}</div>
                    <StatusBadge status={isEnded ? 'ENDED' : 'ACTIVE'} />
                  </div>

                  <h3 className="card-title">{item.title}</h3>
                  <p className="card-desc">{item.description}</p>
                </div>

                <div>
                  {/* Pricing Box */}
                  <div className="card-pricing-box">
                    <div>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                        Current Highest Bid
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-gold)' }}>
                        ₹{Number(item.currentHighestBid || item.highestBid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                        Starting Bid
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                        ₹{Number(item.startingPrice || item.startingBid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Countdown or Winner info */}
                  <div style={{ marginBottom: '1rem' }}>
                    {!isEnded ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <span>Time Remaining:</span>
                        <Countdown endTime={item.endTime} onExpire={() => fetchAuctions(true)} />
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Winner:</span>
                        <span style={{ color: 'var(--accent-gold)', fontWeight: '600' }}>
                          {item.highestBidderName ? `🏆 ${item.highestBidderName}` : 'No Bids'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    className={`btn ${isEnded ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ width: '100%' }}
                    onClick={() => onSelectAuction(item.id)}
                    id={`view-auction-btn-${item.id}`}
                  >
                    {isEnded ? 'View Results & History' : '🔨 View Auction & Place Bid'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
