import React, { useState } from 'react';
import { changeUserPassword } from './api';
import './Login.css';

export default function ChangePasswordModal({ callsign, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!currentPassword || !newPassword) {
      setError('Enter your current and new passwords.');
      return;
    }

    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      onClose(true);
    } catch (submitError) {
      setError(submitError.message || 'Unable to change password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Change Password</h3>
        <p className="login-subtitle">Update the password for {callsign}</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="current-password">Current Password</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm New Password</label>
            <input
              id="confirm-password"
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
              {submitting ? 'Saving...' : 'Save Password'}
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
