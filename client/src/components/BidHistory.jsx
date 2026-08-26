import React from 'react';

export default function BidHistory({ bids, pagination, onPageChange, loading }) {
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '1.15rem' }}>📜 Live Bidding Activity</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {pagination.total} total {pagination.total === 1 ? 'bid' : 'bids'}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          Loading bid history...
        </div>
      ) : bids.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
          No bids placed yet. Be the first to place a bid!
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
                {bids.map((bid, index) => (
                  <tr key={bid.id || index}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="user-avatar" style={{ width: '22px', height: '22px', fontSize: '0.65rem' }}>
                          {(bid.bidderName || 'B').charAt(0).toUpperCase()}
                        </span>
                        <span>{bid.bidderName || 'Anonymous Bidder'}</span>
                        {pagination.page === 1 && index === 0 && (
                          <span style={{ fontSize: '0.65rem', background: 'var(--accent-gold-subtle)', color: 'var(--accent-gold-light)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid var(--accent-gold)' }}>
                            HIGHEST
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="bid-amount">₹{parseFloat(bid.amount).toLocaleString()}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {formatDate(bid.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                id="pagination-prev-btn"
              >
                ← Previous
              </button>
              <span>
                Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
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
