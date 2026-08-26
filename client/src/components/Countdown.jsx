import React from 'react';
import { useCountdown } from '../hooks/useCountdown';

export default function Countdown({ endTime, onExpire }) {
  const timeLeft = useCountdown(endTime);

  // Trigger onExpire if ended
  React.useEffect(() => {
    if (timeLeft.isExpired && onExpire) {
      onExpire();
    }
  }, [timeLeft.isExpired, onExpire]);

  if (timeLeft.isExpired) {
    return (
      <div className="countdown-box" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
        <span style={{ color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ⏱️ Bidding Closed
        </span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Time has expired
        </span>
      </div>
    );
  }

  const format2Digits = (num) => String(num).padStart(2, '0');

  return (
    <div className="countdown-box">
      <div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
          Time Remaining
        </span>
        <span style={{ fontSize: '0.9rem', color: 'var(--accent-gold-light)', fontWeight: 600 }}>
          Live Bidding Active
        </span>
      </div>

      <div className="countdown-digits">
        {timeLeft.days > 0 && (
          <div className="digit-unit">
            <span className="digit-num">{format2Digits(timeLeft.days)}</span>
            <span className="digit-label">Days</span>
          </div>
        )}
        <div className="digit-unit">
          <span className="digit-num">{format2Digits(timeLeft.hours)}</span>
          <span className="digit-label">Hours</span>
        </div>
        <div className="digit-unit">
          <span className="digit-num">{format2Digits(timeLeft.minutes)}</span>
          <span className="digit-label">Mins</span>
        </div>
        <div className="digit-unit">
          <span className="digit-num">{format2Digits(timeLeft.seconds)}</span>
          <span className="digit-label">Secs</span>
        </div>
      </div>
    </div>
  );
}
