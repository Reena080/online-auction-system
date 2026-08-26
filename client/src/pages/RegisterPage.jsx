import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage({ setView }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password);
      setView('auction');
    } catch (err) {
      if (err.errorCode === 'EMAIL_EXISTS') {
        setErrorMsg('An account with this email address already exists. Please login instead.');
      } else {
        setErrorMsg(err.message || 'Failed to register account.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="card">
        <div className="auth-header">
          <h2>Create Account</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Join Bellcorp Auctions to participate in live bidding
          </p>
        </div>

        {errorMsg && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem' }} id="register-error-alert">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="register-name">
              Full Name
            </label>
            <input
              id="register-name"
              type="text"
              className="input-field"
              placeholder="e.g. Charlie Brown"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-email">
              Email Address
            </label>
            <input
              id="register-email"
              type="email"
              className="input-field"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-password">
              Password (min 6 characters)
            </label>
            <input
              id="register-password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
            id="submit-register-btn"
          >
            {loading ? 'Creating Account...' : 'Register & Start Bidding'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <span className="auth-link" onClick={() => setView('login')} id="goto-login-link">
            Sign In
          </span>
        </div>
      </div>
    </div>
  );
}
