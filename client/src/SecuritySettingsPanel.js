import React, { useEffect, useState } from 'react';
import {
  fetchAppConfig,
  saveAppConfig,
  fetchUsers,
  createUserAccount,
  updateUserAccount,
  deleteUserAccount,
  apiFetch
} from './api';
import { useAuth } from './AuthContext';
import { formatHeaderTitle, getEntryClubName } from './branding';
import AdminResetPasswordModal from './AdminResetPasswordModal';

function SecuritySettingsPanel() {
  const { refreshStatus, loginAdmin } = useAuth();
  const [config, setConfig] = useState({
    clubName: '',
    authMode: 'shared_password',
    siteLoginEnabled: false,
    sitePasswordSet: false,
    adminPasswordSet: false
  });
  const [users, setUsers] = useState([]);
  const [newSitePassword, setNewSitePassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newUserCallsign, setNewUserCallsign] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [newUserLookupName, setNewUserLookupName] = useState('');
  const [newUserLookupStatus, setNewUserLookupStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resetPasswordCallsign, setResetPasswordCallsign] = useState(null);

  const userAccountsMode = config.authMode === 'user_accounts';

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    const callsign = newUserCallsign.trim().toUpperCase();
    if (!callsign || callsign.length < 3) {
      setNewUserLookupName('');
      setNewUserLookupStatus(null);
      return undefined;
    }

    setNewUserLookupStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch(`/api/lookup/${callsign}`);
        const data = await response.json();
        if (data.success) {
          setNewUserLookupName(data.name || '');
          setNewUserLookupStatus('found');
        } else {
          setNewUserLookupName('');
          setNewUserLookupStatus('not-found');
        }
      } catch {
        setNewUserLookupName('');
        setNewUserLookupStatus('not-found');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [newUserCallsign]);

  const loadConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAppConfig();
      setConfig({
        ...data,
        authMode: data.authMode || 'shared_password',
        clubName: getEntryClubName(data.clubName)
      });

      if (data.authMode === 'user_accounts') {
        setUsers(await fetchUsers());
      } else {
        setUsers([]);
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load security settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setMessage('');

    const clubName = getEntryClubName(config.clubName);
    if (clubName.length > 60) {
      setError('Name must be 60 characters or less.');
      return;
    }

    if (!userAccountsMode && config.siteLoginEnabled && !config.sitePasswordSet && !newSitePassword) {
      setError('Enter a site password or uncheck "Require site login password".');
      return;
    }

    setSaving(true);
    try {
      const saved = await saveAppConfig({
        clubName,
        authMode: config.authMode,
        siteLoginEnabled: userAccountsMode ? false : config.siteLoginEnabled,
        newSitePassword: userAccountsMode ? undefined : (newSitePassword || undefined),
        newAdminPassword: userAccountsMode ? undefined : (newAdminPassword || undefined)
      });

      setConfig(saved);
      if (newAdminPassword) {
        await loginAdmin(newAdminPassword);
      }
      setNewSitePassword('');
      setNewAdminPassword('');
      await refreshStatus();
      if (userAccountsMode) {
        setUsers(await fetchUsers());
      }
      setMessage('Security settings saved.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save security settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearSitePassword = async () => {
    if (!window.confirm('Disable site login and clear the site password?')) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      const saved = await saveAppConfig({ clearSitePassword: true });
      setConfig(saved);
      setNewSitePassword('');
      setConfig((prev) => ({ ...prev, siteLoginEnabled: false }));
      await refreshStatus();
      setMessage('Site login disabled.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to clear site password.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearAdminPassword = async () => {
    if (!window.confirm('Remove admin password? The admin panel will be open to anyone.')) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      const saved = await saveAppConfig({ clearAdminPassword: true });
      setConfig(saved);
      setNewAdminPassword('');
      await refreshStatus();
      setMessage('Admin password removed.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to clear admin password.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddUser = async () => {
    setError('');
    setMessage('');

    const callsign = newUserCallsign.trim().toUpperCase();
    if (!callsign || !newUserPassword) {
      setError('Callsign and password are required for a new user.');
      return;
    }

    setSaving(true);
    try {
      await createUserAccount({
        callsign,
        password: newUserPassword,
        isAdmin: newUserIsAdmin
      });
      setNewUserCallsign('');
      setNewUserPassword('');
      setNewUserIsAdmin(false);
      setNewUserLookupName('');
      setNewUserLookupStatus(null);
      setUsers(await fetchUsers());
      await refreshStatus();
      setMessage(`Added user ${callsign}.`);
    } catch (saveError) {
      setError(saveError.message || 'Unable to add user.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserAdmin = async (user) => {
    setSaving(true);
    setError('');
    try {
      await updateUserAccount(user.callsign, { isAdmin: !user.isAdmin });
      setUsers(await fetchUsers());
      setMessage(`Updated ${user.callsign}.`);
    } catch (saveError) {
      setError(saveError.message || 'Unable to update user.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (callsign) => {
    if (!window.confirm(`Remove user ${callsign}?`)) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      await deleteUserAccount(callsign);
      setUsers(await fetchUsers());
      await refreshStatus();
      setMessage(`Removed user ${callsign}.`);
    } catch (saveError) {
      setError(saveError.message || 'Unable to remove user.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="station-settings-panel">Loading security settings...</div>;
  }

  return (
    <div className="station-settings-panel">
      <div className="settings-scroll-area">
        <div className="settings-intro">
          <p>
            Configure branding and access control. Use a shared site password, or individual
            operator accounts with callsign and password. Passwords are stored as bcrypt hashes.
          </p>
        </div>

        <div className="settings-grid security-settings-grid">
          <section className="settings-section">
            <h2>Branding</h2>
            <div className="settings-fields">
              <label>
                Club / Individual Name
                <input
                  type="text"
                  maxLength={60}
                  value={config.clubName}
                  onChange={(e) => setConfig((prev) => ({ ...prev, clubName: e.target.value }))}
                  placeholder="e.g., K1FMK or Your Club Name"
                />
                <span className="field-hint">
                  Shown in the header as “{formatHeaderTitle(config.clubName || 'Your Club')}”.
                  Leave blank to show CQ Rush only.
                </span>
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h2>Authentication Mode</h2>
            <div className="settings-fields auth-mode-options">
              <label className="auth-mode-option">
                <input
                  type="radio"
                  name="authMode"
                  checked={config.authMode === 'shared_password'}
                  onChange={() => setConfig((prev) => ({ ...prev, authMode: 'shared_password' }))}
                />
                <span>
                  <strong>Shared site password</strong>
                  <span className="field-hint">One password for everyone who accesses the logger.</span>
                </span>
              </label>
              <label className="auth-mode-option">
                <input
                  type="radio"
                  name="authMode"
                  checked={config.authMode === 'user_accounts'}
                  onChange={() => setConfig((prev) => ({ ...prev, authMode: 'user_accounts' }))}
                />
                <span>
                  <strong>Individual operator accounts</strong>
                  <span className="field-hint">Each operator signs in with callsign and password. Admin access is per user.</span>
                </span>
              </label>
            </div>
          </section>

          {!userAccountsMode && (
            <>
              <section className="settings-section">
                <h2>Site Login (Optional)</h2>
                <p className="section-note">
                  When disabled, anyone can access the logger without a password.
                </p>
                <div className="settings-fields">
                  <label className="bonus-item">
                    <input
                      type="checkbox"
                      checked={config.siteLoginEnabled}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        siteLoginEnabled: e.target.checked
                      }))}
                    />
                    <span className="bonus-label">Require site login password</span>
                  </label>

                  <label>
                    {config.sitePasswordSet ? 'New Site Password' : 'Site Password'}
                    <input
                      type="password"
                      value={newSitePassword}
                      onChange={(e) => setNewSitePassword(e.target.value)}
                      placeholder={config.sitePasswordSet ? 'Leave blank to keep current' : 'Set site password'}
                      disabled={!config.siteLoginEnabled}
                    />
                  </label>

                  {config.sitePasswordSet && (
                    <button
                      type="button"
                      className="btn-secondary security-clear-btn"
                      onClick={handleClearSitePassword}
                      disabled={saving}
                    >
                      Disable Site Login &amp; Clear Password
                    </button>
                  )}
                </div>
              </section>

              <section className="settings-section">
                <h2>Admin Panel Password</h2>
                <p className="section-note">
                  Protects Admin, Station Settings, and Security pages.
                </p>
                <div className="settings-fields">
                  <label>
                    {config.adminPasswordSet ? 'New Admin Password' : 'Admin Password'}
                    <input
                      type="password"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder={config.adminPasswordSet ? 'Leave blank to keep current' : 'Set admin password'}
                    />
                  </label>

                  {config.adminPasswordSet && (
                    <button
                      type="button"
                      className="btn-secondary security-clear-btn"
                      onClick={handleClearAdminPassword}
                      disabled={saving}
                    >
                      Remove Admin Password
                    </button>
                  )}
                </div>
              </section>
            </>
          )}

          {userAccountsMode && (
            <section className="settings-section security-users-section">
              <h2>Authorized Operators</h2>
              <p className="section-note">
                Login is required once at least one operator is listed. Save settings after switching to this mode.
              </p>

              <div className="security-user-add">
                <label className="security-user-callsign-field">
                  Callsign
                  <input
                    type="text"
                    value={newUserCallsign}
                    onChange={(e) => setNewUserCallsign(e.target.value.toUpperCase())}
                    placeholder="e.g., N7PHX"
                  />
                  {newUserLookupStatus === 'loading' && (
                    <span className="security-user-lookup">Looking up...</span>
                  )}
                  {newUserLookupStatus === 'found' && newUserLookupName && (
                    <span className="security-user-lookup security-user-lookup-name">
                      {newUserLookupName}
                    </span>
                  )}
                  {newUserLookupStatus === 'not-found' && (
                    <span className="security-user-lookup security-user-lookup-missing">
                      Name not found in lookup
                    </span>
                  )}
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Set password"
                  />
                </label>
                <label className="bonus-item">
                  <input
                    type="checkbox"
                    checked={newUserIsAdmin}
                    onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                  />
                  <span className="bonus-label">Admin access</span>
                </label>
                <button
                  type="button"
                  className="btn-save"
                  onClick={handleAddUser}
                  disabled={saving || !newUserCallsign.trim() || !newUserPassword}
                >
                  Add Operator
                </button>
              </div>

              {users.length === 0 ? (
                <p className="section-note">No operators configured yet.</p>
              ) : (
                <table className="security-users-table">
                  <thead>
                    <tr>
                      <th>Callsign</th>
                      <th>Admin</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.callsign}>
                        <td>{user.callsign}</td>
                        <td>{user.isAdmin ? 'Yes' : 'No'}</td>
                        <td className="security-user-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setResetPasswordCallsign(user.callsign)}
                            disabled={saving}
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleToggleUserAdmin(user)}
                            disabled={saving}
                          >
                            {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                          </button>
                          <button
                            type="button"
                            className="btn-delete"
                            onClick={() => handleDeleteUser(user.callsign)}
                            disabled={saving}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </div>
      </div>

      <div className="settings-actions">
        {error && <p className="settings-error">{error}</p>}
        {message && <p className="settings-success">{message}</p>}
        <button type="button" className="btn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Security Settings'}
        </button>
      </div>

      {resetPasswordCallsign && (
        <AdminResetPasswordModal
          callsign={resetPasswordCallsign}
          onClose={(saved) => {
            setResetPasswordCallsign(null);
            if (saved) {
              setMessage(`Password reset for ${resetPasswordCallsign}.`);
              setError('');
            }
          }}
        />
      )}
    </div>
  );
}

export default SecuritySettingsPanel;
