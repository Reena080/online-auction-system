import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ setView }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      await login(email, password);
      setView('auction');
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (testEmail, testPassword) => {
    setEmail(testEmail);
    setPassword(testPassword);
  };

  return (
    <div className="auth-container">
      <div className="card">
        <div className="auth-header">
          <h2>Welcome Back</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Sign in to your Bellcorp account to place bids
          </p>
        </div>

        {errorMsg && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem' }} id="login-error-alert">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className="input-field"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
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
            id="submit-login-btn"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="quick-logins">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem', width: '100%' }}>
            Demo Test Accounts:
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ flex: 1 }}
            onClick={() => handleQuickLogin('alice@bellcorp.com', 'Password123!')}
            id="quick-login-alice"
          >
            👤 Alice Walker
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ flex: 1 }}
            onClick={() => handleQuickLogin('bob@bellcorp.com', 'Password123!')}
            id="quick-login-bob"
          >
            👤 Bob Smith
          </button>
        </div>

        <div className="auth-footer">
          Don't have an account?{' '}
          <span className="auth-link" onClick={() => setView('register')} id="goto-register-link">
            Create an account
          </span>
        </div>
      </div>
    </div>
  );
}
