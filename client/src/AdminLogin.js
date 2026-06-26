import React, { useState } from 'react';
import { BRAND_ASSETS, APP_NAME } from './branding';
import './Login.css';

function AdminLogin({ clubName, onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await onLogin(password);
    } catch (loginError) {
      setError(loginError.message || 'Invalid admin password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page admin-login-page">
      <div className="login-card">
        <img src={BRAND_ASSETS.logo} alt={APP_NAME} className="login-logo" />
        <h1>{clubName || APP_NAME}</h1>
        <p className="login-subtitle">Admin access — enter the admin password</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="admin-password">Admin Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter admin password"
            autoComplete="current-password"
            autoFocus
            required
          />

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={submitting || !password}>
            {submitting ? 'Signing in...' : 'Enter Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
