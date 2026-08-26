import { useState, useEffect } from 'react';

export function useCountdown(targetDate) {
  const calculateTimeLeft = () => {
    if (!targetDate) {
      return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    const difference = new Date(targetDate).getTime() - new Date().getTime();

    if (difference <= 0) {
      return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    return {
      total: difference,
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      isExpired: false
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining.isExpired) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}
