import React, { useState } from 'react';
import { updateUserAccount } from './api';
import './Login.css';

export default function AdminResetPasswordModal({ callsign, onClose }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!newPassword) {
      setError('Enter a new password.');
      return;
    }

    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await updateUserAccount(callsign, { password: newPassword });
      onClose(true);
    } catch (submitError) {
      setError(submitError.message || 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Reset Password</h3>
        <p className="login-subtitle">Set a new password for {callsign}</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="admin-new-password">New Password</label>
            <input
              id="admin-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-confirm-password">Confirm Password</label>
            <input
              id="admin-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <div className="modal-buttons">
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Saving...' : 'Reset Password'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onClose(false)}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
