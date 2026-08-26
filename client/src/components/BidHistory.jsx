import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export default function BidHistory({ 
  auctionId, 
  refreshTrigger, 
  bids: propBids, 
  pagination: propPagination, 
  onPageChange: propOnPageChange, 
  loading: propLoading 
}) {
  const [internalBids, setInternalBids] = useState(propBids || []);
  const [internalPagination, setInternalPagination] = useState(
    propPagination || { total: 0, page: 1, totalPages: 1, limit: 10 }
  );
  const [internalLoading, setInternalLoading] = useState(propLoading !== undefined ? propLoading : !!auctionId);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchBids = useCallback(async (targetPage = 1) => {
    if (!auctionId) return;
    try {
      setInternalLoading(true);
      const res = await api.auction.getBids(auctionId, targetPage, 10);
      if (res.success) {
        setInternalBids(res.data || []);
        setInternalPagination(
          res.pagination || { total: (res.data || []).length, page: targetPage, totalPages: 1 }
        );
      }
    } catch (err) {
      console.warn('[BID_HISTORY] Error fetching bids:', err.message);
    } finally {
      setInternalLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    if (auctionId) {
      fetchBids(currentPage);
    }
  }, [auctionId, currentPage, refreshTrigger, fetchBids]);

  const bids = propBids || internalBids || [];
  const pagination = propPagination || internalPagination || { total: bids.length, page: 1, totalPages: 1 };
  const loading = propLoading !== undefined ? propLoading : internalLoading;

  const handlePageChange = (newPage) => {
    if (propOnPageChange) {
      propOnPageChange(newPage);
    } else {
      setCurrentPage(newPage);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        ' · ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const totalBids = pagination.total || bids.length || 0;
  const maxBidAmount = bids.length > 0 ? Math.max(...bids.map(b => parseFloat(b.amount || 0))) : 0;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)' }}>📜 Live Bidding Activity</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {totalBids} total {totalBids === 1 ? 'bid' : 'bids'}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          Loading bid history...
        </div>
      ) : bids.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>No bids placed yet.</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Be the first to place a bid on this item!</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="bid-table">
              <thead>
                <tr>
                  <th>Bidder</th>
                  <th>Amount</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((bid, index) => {
                  const bidderName = bid.bidderName || bid.userName || 'Anonymous Bidder';
                  const amountNum = parseFloat(bid.amount || 0);
                  const isHighest = amountNum === maxBidAmount && maxBidAmount > 0;

                  return (
                    <tr key={bid.id || index}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="user-avatar" style={{ width: '22px', height: '22px', fontSize: '0.65rem' }}>
                            {bidderName.charAt(0).toUpperCase()}
                          </span>
                          <span style={{ fontWeight: isHighest ? '700' : 'normal', color: isHighest ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                            {bidderName}
                          </span>
                          {isHighest && (
                            <span style={{ fontSize: '0.65rem', background: 'var(--accent-gold-subtle)', color: 'var(--accent-gold-light)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid var(--accent-gold)', fontWeight: 'bold' }}>
                              HIGHEST
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="bid-amount" style={{ fontWeight: '700', color: isHighest ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                        ₹{amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatDate(bid.createdAt || bid.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handlePageChange((pagination.page || 1) - 1)}
                disabled={(pagination.page || 1) <= 1}
                id="pagination-prev-btn"
              >
                ← Previous
              </button>
              <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                Page <strong>{pagination.page || 1}</strong> of <strong>{pagination.totalPages || 1}</strong>
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handlePageChange((pagination.page || 1) + 1)}
                disabled={(pagination.page || 1) >= (pagination.totalPages || 1)}
                id="pagination-next-btn"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
