import React from 'react';

export default function StatusBadge({ status }) {
  const isActive = status === 'ACTIVE';

  return (
    <span className={`status-pill ${isActive ? 'status-active' : 'status-ended'}`}>
      <span className="pulse-dot"></span>
      {isActive ? 'Live Auction' : 'Auction Ended'}
    </span>
  );
}
