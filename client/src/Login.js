import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND_ASSETS, APP_NAME } from './branding';
import AppFooter from './AppFooter';
import './Login.css';

function Login({ clubName, authMode, onLogin }) {
  const userAuthMode = authMode === 'user_accounts';
  const [callsign, setCallsign] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sessionConflict, setSessionConflict] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState(null);

  const attemptLogin = async (credentials) => {
    setError('');
    setSubmitting(true);

    try {
      await onLogin(credentials);
      setSessionConflict(false);
      setPendingCredentials(null);
    } catch (loginError) {
      if (loginError.sessionConflict) {
        setPendingCredentials(credentials);
        setSessionConflict(true);
        return;
      }
      setError(loginError.message || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (userAuthMode) {
      await attemptLogin({
        callsign: callsign.trim().toUpperCase(),
        password
      });
      return;
    }

    await attemptLogin({ password });
  };

  const handleDisconnectAndContinue = async () => {
    if (!pendingCredentials) {
      return;
    }

    await attemptLogin({
      ...pendingCredentials,
      forceDisconnect: true
    });
  };

  const handleCancelConflict = () => {
    setSessionConflict(false);
    setPendingCredentials(null);
    setError('');
  };

  const canSubmit = userAuthMode
    ? Boolean(callsign.trim() && password)
    : Boolean(password);

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-card">
          <img src={BRAND_ASSETS.logo} alt={APP_NAME} className="login-logo" />
          <h1>{clubName || APP_NAME}</h1>
          <p className="login-subtitle">
            {userAuthMode
              ? 'Enter your callsign and password to continue'
              : 'Enter the site access password to continue'}
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            {userAuthMode && (
              <>
                <label htmlFor="callsign">Callsign</label>
                <input
                  id="callsign"
                  type="text"
                  value={callsign}
                  onChange={(event) => setCallsign(event.target.value.toUpperCase())}
                  placeholder="e.g., W1AW"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </>
            )}

            <label htmlFor="password">{userAuthMode ? 'Password' : 'Site Password'}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              autoFocus={!userAuthMode}
              required
            />

            {error && <p className="login-error">{error}</p>}

            <button type="submit" disabled={submitting || !canSubmit || sessionConflict}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="login-about-link">
            <Link to="/about">About {APP_NAME} · free &amp; open source</Link>
          </p>
        </div>

        <AppFooter />
      </div>

      {sessionConflict && (
        <div className="login-conflict-overlay" role="dialog" aria-modal="true" aria-labelledby="login-conflict-title">
          <div className="login-conflict-dialog">
            <h2 id="login-conflict-title">Already Signed In</h2>
            <p>
              This account is active on another device. Disconnect that session and continue here,
              or cancel to keep the other session active.
            </p>
            <div className="login-conflict-actions">
              <button
                type="button"
                className="login-conflict-primary"
                onClick={handleDisconnectAndContinue}
                disabled={submitting}
              >
                {submitting ? 'Signing in...' : 'Disconnect & Continue'}
              </button>
              <button
                type="button"
                className="login-conflict-secondary"
                onClick={handleCancelConflict}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
