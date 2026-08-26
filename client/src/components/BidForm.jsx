import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function BidForm({ auction, onBidSuccess, setView }) {
  const { isAuthenticated, user } = useAuth();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const currentHighest = parseFloat(auction.currentHighestBid || auction.startingPrice || 0);
  const minNextBid = currentHighest + 1;
  const isAuctionEnded = auction.status === 'ENDED' || (auction.endTime && new Date(auction.endTime) <= new Date());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isAuthenticated) {
      setErrorMsg('Please login to place a bid.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Please enter a valid bid amount.');
      return;
    }

    if (numAmount <= currentHighest) {
      setErrorMsg(`Bid must be strictly higher than the current highest bid of ₹${currentHighest.toLocaleString()}.`);
      return;
    }

    setLoading(true);

    try {
      const response = await api.auction.placeBid(auction.id, numAmount);
      if (response.success) {
        setSuccessMsg(`🎉 Success! Your bid of ₹${numAmount.toLocaleString()} has been accepted!`);
        setAmount('');
        if (onBidSuccess) {
          onBidSuccess(response.data);
        }
      }
    } catch (err) {
      if (err.errorCode === 'AUCTION_ENDED') {
        setErrorMsg('The auction has already ended. Bidding is now closed.');
      } else if (err.errorCode === 'BID_TOO_LOW') {
        setErrorMsg(err.message || `Bid rejected. Your bid must be higher than ₹${currentHighest.toLocaleString()}.`);
      } else if (err.errorCode === 'RATE_LIMIT_EXCEEDED') {
        setErrorMsg('Too many bid attempts. Maximum 10 bids per minute. Please wait a few seconds.');
      } else if (err.status === 401) {
        setErrorMsg('Session expired. Please login again to bid.');
      } else {
        setErrorMsg(err.message || 'An unexpected error occurred while placing your bid.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bid-form-container">
      {errorMsg && (
        <div className="alert alert-error" id="bid-error-alert">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success" id="bid-success-alert">
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="bid-amount-input">
            Your Bid Amount
          </label>
          <div className="bid-input-wrap">
            <span className="currency-symbol">₹</span>
            <input
              id="bid-amount-input"
              type="number"
              className="input-field"
              placeholder={minNextBid.toString()}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="any"
              disabled={isAuctionEnded || loading || !isAuthenticated}
              required
            />
          </div>
          <div className="form-hint">
            Minimum required bid: <strong style={{ color: 'var(--text-primary)' }}>₹{minNextBid.toLocaleString()}</strong>
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          {!isAuthenticated ? (
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              style={{ width: '100%' }}
              onClick={() => setView('login')}
              id="bid-login-prompt-btn"
            >
              🔑 Login to Place a Bid
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={isAuctionEnded || loading}
              id="place-bid-button"
            >
              {loading ? (
                <span>⏳ Submitting Bid...</span>
              ) : isAuctionEnded ? (
                <span>🚫 Bidding Closed</span>
              ) : (
                <span>⚡ Place Bid Now</span>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
