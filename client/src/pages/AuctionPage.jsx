import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Countdown from '../components/Countdown';
import BidForm from '../components/BidForm';
import BidHistory from '../components/BidHistory';

export default function AuctionPage({ setView }) {
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loadingAuction, setLoadingAuction] = useState(true);
  const [loadingBids, setLoadingBids] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchAuctionData = useCallback(async (isInitial = false) => {
    try {
      const res = await api.auction.get();
      if (res.success && res.data) {
        setAuction(res.data);
      }
    } catch (err) {
      if (isInitial) {
        setErrorMsg('Failed to load auction data. Please make sure the backend server is running.');
      }
    } finally {
      if (isInitial) setLoadingAuction(false);
    }
  }, []);

  const fetchBids = useCallback(async (auctionId, page = 1) => {
    if (!auctionId) return;
    setLoadingBids(true);
    try {
      const res = await api.auction.getBids(auctionId, page, 10);
      if (res.success) {
        setBids(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      console.warn('[BID_HISTORY] Could not load bids:', err.message);
    } finally {
      setLoadingBids(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchAuctionData(true);
  }, [fetchAuctionData]);

  // Load bids once auction is available
  useEffect(() => {
    if (auction?.id) {
      fetchBids(auction.id, pagination.page);
    }
  }, [auction?.id, pagination.page, fetchBids]);

  // Polling: Poll every 3 seconds while active
  useEffect(() => {
    if (!auction) return;
    const isEnded = auction.status === 'ENDED' || new Date(auction.endTime) <= new Date();

    const interval = setInterval(() => {
      fetchAuctionData(false);
      if (auction.id) {
        fetchBids(auction.id, pagination.page);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [auction?.id, auction?.status, auction?.endTime, pagination.page, fetchAuctionData, fetchBids]);

  const handleBidSuccess = (bidResult) => {
    // Immediately update local state and re-fetch fresh data
    if (bidResult.auction) {
      setAuction((prev) => ({ ...prev, ...bidResult.auction }));
    }
    if (auction?.id) {
      fetchBids(auction.id, 1);
      setPagination((p) => ({ ...p, page: 1 }));
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((p) => ({ ...p, page: newPage }));
    }
  };

  if (loadingAuction) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0' }}>
        <h3 style={{ color: 'var(--accent-gold-light)', marginBottom: '0.5rem' }}>⏳ Loading Auction...</h3>
        <p style={{ color: 'var(--text-muted)' }}>Fetching live auction and current bids from PostgreSQL source of truth</p>
      </div>
    );
  }

  if (errorMsg || !auction) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
        <h3 style={{ color: '#ef4444', marginBottom: '1rem' }}>⚠️ Connection Error</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {errorMsg || 'No active auctions found.'}
        </p>
        <button className="btn btn-primary" onClick={() => fetchAuctionData(true)}>
          🔄 Retry Connection
        </button>
      </div>
    );
  }

  const isAuctionEnded = auction.status === 'ENDED' || new Date(auction.endTime) <= new Date();

  return (
    <div>
      {/* Winner Spotlight Banner if ended */}
      {isAuctionEnded && (
        <div className="winner-banner" id="auction-ended-banner">
          <h4>🏆 AUCTION CONCLUDED</h4>
          <p>
            {auction.highestBidderName ? (
              <>
                Winner: <strong>{auction.highestBidderName}</strong> with a final winning bid of{' '}
                <strong style={{ color: 'var(--accent-gold-light)' }}>
                  ₹{parseFloat(auction.currentHighestBid).toLocaleString()}
                </strong>
              </>
            ) : (
              <>Auction ended with no bids placed above the starting price.</>
            )}
          </p>
        </div>
      )}

      {/* Main Auction Grid */}
      <div className="auction-grid">
        {/* Left Column: Auction Item Details & Bid Placement */}
        <div className="card">
          <div className="auction-header">
            <div>
              <h2 className="auction-title" id="auction-item-title">{auction.title}</h2>
              <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <StatusBadge status={isAuctionEnded ? 'ENDED' : 'ACTIVE'} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ID: {auction.id}
                </span>
              </div>
            </div>
          </div>

          <p className="auction-description">{auction.description}</p>

          {/* Pricing Spotlight */}
          <div className="price-spotlight">
            <div className="price-item">
              <span className="price-label">Starting Price</span>
              <span className="price-val">₹{parseFloat(auction.startingPrice).toLocaleString()}</span>
            </div>

            <div className="price-item">
              <span className="price-label">
                {isAuctionEnded ? 'Winning Bid' : 'Current Highest Bid'}
              </span>
              <span className="price-val highlight" id="current-highest-bid-display">
                ₹{parseFloat(auction.currentHighestBid).toLocaleString()}
              </span>
              {auction.highestBidderName && (
                <div className="bidder-tag">
                  <span>👤</span>
                  <span>Leader: <strong>{auction.highestBidderName}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Live Countdown */}
          <Countdown
            endTime={auction.endTime}
            onExpire={() => setAuction((prev) => ({ ...prev, status: 'ENDED' }))}
          />

          {/* Bid Submission Form */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>
              {isAuctionEnded ? 'Auction Status' : 'Place Your Bid'}
            </h3>
            <BidForm
              auction={auction}
              onBidSuccess={handleBidSuccess}
              setView={setView}
            />
          </div>
        </div>

        {/* Right Column: Live Paginated Bid History */}
        <div className="card">
          <BidHistory
            bids={bids}
            pagination={pagination}
            onPageChange={handlePageChange}
            loading={loadingBids}
          />
        </div>
      </div>
    </div>
  );
}
