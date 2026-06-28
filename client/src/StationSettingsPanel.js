import React, { useEffect, useState } from 'react';
import { apiFetch, fetchContests, setActiveContest } from './api';
import { useAuth } from './AuthContext';
import { getContestDefinition } from './contests/registry';
import {
  ARRL_VALID_SECTIONS,
  BONUS_GROUPS,
  DEFAULT_STATION_SETTINGS,
  ENTRY_CLASS_OPTIONS,
  POWER_MULTIPLIER_OPTIONS,
  calculateBonusPoints,
  calculateProjectedScore,
  formatExchange,
  normalizeStationSettings,
  validateEntryClass
} from './fieldDayRules';

function StationSettingsPanel({ contactCount = 0 }) {
  const { status, refreshStatus } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_STATION_SETTINGS);
  const [contests, setContests] = useState([]);
  const [activeContestSlug, setActiveContestSlug] = useState('field-day');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingContest, setSwitchingContest] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadPanelData();
  }, []);

  useEffect(() => {
    if (status.activeContest?.slug) {
      setActiveContestSlug(status.activeContest.slug);
    }
  }, [status.activeContest?.slug]);

  const loadPanelData = async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsRes, contestsList] = await Promise.all([
        apiFetch('/api/station-settings'),
        fetchContests().catch(() => [])
      ]);

      if (settingsRes.ok) {
        setSettings(normalizeStationSettings(await settingsRes.json()));
      } else {
        setError('Unable to load station settings.');
      }

      setContests(contestsList);
      if (status.activeContest?.slug) {
        setActiveContestSlug(status.activeContest.slug);
      }
    } catch (loadError) {
      console.error('Error loading station settings:', loadError);
      setError('Unable to load station settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleContestChange = async (event) => {
    const slug = event.target.value;
    if (!slug || slug === activeContestSlug) {
      return;
    }

    setSwitchingContest(true);
    setError('');
    setMessage('');
    try {
      await setActiveContest(slug);
      setActiveContestSlug(slug);
      await refreshStatus();
      await loadPanelData();
      setMessage(`Switched to ${getContestDefinition(slug)?.name || slug}. Logbook and settings now show that contest.`);
    } catch (switchError) {
      setError(switchError.message || 'Unable to switch contest.');
    } finally {
      setSwitchingContest(false);
    }
  };

  const updateField = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const updateBonus = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      bonuses: {
        ...prev.bonuses,
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    setError('');
    setMessage('');

    if (settings.entryClass && !validateEntryClass(settings.entryClass)) {
      setError('Entry class must be A, B, C, D, E, or F.');
      return;
    }

    const section = (settings.section || '').toUpperCase();
    if (section && !ARRL_VALID_SECTIONS.includes(section)) {
      setError('Section must be a valid ARRL/RAC section abbreviation.');
      return;
    }

    const payload = normalizeStationSettings(settings);

    setSaving(true);
    try {
      const response = await apiFetch('/api/station-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${response.status})`);
      }

      const saved = normalizeStationSettings(await response.json());
      setSettings(saved);
      setMessage('Station settings saved.');
    } catch (saveError) {
      console.error('Error saving station settings:', saveError);
      setError(saveError.message || 'Unable to save station settings.');
    } finally {
      setSaving(false);
    }
  };

  const exchange = formatExchange(settings);
  const bonusPreview = calculateBonusPoints(settings);

  const activeContest = getContestDefinition(activeContestSlug);
  const contestLabel = status.activeContest?.name || activeContest?.name || 'Field Day';

  if (loading) {
    return <div className="station-settings-panel">Loading station settings...</div>;
  }

  return (
    <div className="station-settings-panel">
      <div className="settings-scroll-area">
        <div className="settings-intro">
          <p>
            Configure your <strong>{contestLabel}</strong> entry. These settings drive the projected score on the
            main logger and define the exchange you send (e.g., <strong>3A AZ</strong>).
          </p>
        </div>

        {contests.length > 0 && (
          <div className="settings-contest-bar">
            <span className="settings-contest-bar-label">Active Contest</span>
            <select
              className="settings-contest-bar-select"
              value={activeContestSlug}
              onChange={handleContestChange}
              disabled={switchingContest || saving}
              aria-label="Contest logbook"
            >
              {contests.map((contest) => (
                <option key={contest.slug} value={contest.slug}>
                  {contest.name}
                </option>
              ))}
            </select>
            <span className="settings-contest-bar-hint">
              Each contest keeps its own QSO log and station settings.
            </span>
          </div>
        )}

        <div className="settings-grid">
          <section className="settings-section">
            <h2>Station Identity</h2>
            <div className="settings-fields">
              <label>
                Entry Callsign
                <input
                  type="text"
                  value={settings.callsign || ''}
                  onChange={(e) => updateField('callsign', e.target.value.toUpperCase())}
                  placeholder="e.g., W1AW"
                  maxLength={12}
                />
                <span className="field-hint">Call used for Field Day — appears in Cabrillo header</span>
              </label>

              <label>
                Entry Class
                <select
                  value={settings.entryClass || ''}
                  onChange={(e) => updateField('entryClass', e.target.value)}
                >
                  <option value="">Select class...</option>
                  {ENTRY_CLASS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="field-hint">ARRL category letter (A–F)</span>
              </label>

              <label>
                Number of Transmitters
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.transmitterCount}
                  onChange={(e) => updateField('transmitterCount', Number(e.target.value))}
                />
                <span className="field-hint">Combined with class for exchange (e.g., 3 + A = 3A)</span>
              </label>

              <label>
                ARRL/RAC Section
                <input
                  type="text"
                  value={settings.section}
                  onChange={(e) => updateField('section', e.target.value.toUpperCase())}
                  placeholder="e.g., AZ"
                  list="arrl-sections-list"
                />
                <datalist id="arrl-sections-list">
                  {ARRL_VALID_SECTIONS.map((section) => (
                    <option key={section} value={section} />
                  ))}
                </datalist>
              </label>

              <label>
                Power Multiplier
                <select
                  value={settings.powerMultiplier}
                  onChange={(e) => updateField('powerMultiplier', Number(e.target.value))}
                >
                  {POWER_MULTIPLIER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {exchange && (
              <div className="exchange-preview">
                Your exchange: <strong>{exchange}</strong>
              </div>
            )}
          </section>

          <section className="settings-section">
            <h2>Bonus Points</h2>
            <p className="section-note">
              Check bonuses you plan to claim on your ARRL summary sheet. Proof is required for submission.
            </p>

            {BONUS_GROUPS.map((group) => (
              <div key={group.title} className="bonus-group">
                <h3>{group.title}</h3>
                <div className="bonus-items">
                  {group.items.map((item) => (
                    <label key={item.key} className={`bonus-item ${item.type === 'number' ? 'bonus-number' : ''}`}>
                      {item.type === 'checkbox' ? (
                        <>
                          <input
                            type="checkbox"
                            checked={Boolean(settings.bonuses[item.key])}
                            onChange={(e) => updateBonus(item.key, e.target.checked)}
                          />
                          <span className="bonus-label">
                            {item.label}
                            <span className="bonus-points">+{item.points}</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="bonus-label">
                            {item.label}
                            <span className="bonus-points">+{item.points}</span>
                          </span>
                          <input
                            type="number"
                            min={item.min}
                            max={item.max}
                            value={settings.bonuses[item.key] || 0}
                            onChange={(e) => updateBonus(item.key, Number(e.target.value))}
                          />
                        </>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="settings-section settings-summary">
            <h2>Score Preview</h2>
            <div className="score-preview-card">
              <div className="score-preview-row">
                <span>QSO points (from logger)</span>
                <span>Live on main page</span>
              </div>
              <div className="score-preview-row">
                <span>Power multiplier</span>
                <span>×{settings.powerMultiplier}</span>
              </div>
              <div className="score-preview-row">
                <span>Bonus points configured</span>
                <span>+{bonusPreview.total}</span>
              </div>
              {bonusPreview.breakdown.length > 0 && (
                <ul className="bonus-breakdown-list">
                  {bonusPreview.breakdown.map((item) => (
                    <li key={item.label}>
                      {item.label}: +{item.points}
                    </li>
                  ))}
                </ul>
              )}
              <div className="score-preview-formula">
                Projected = (QSO points × {settings.powerMultiplier}) + {bonusPreview.total} bonuses
              </div>
              <div className="score-preview-note">
                {contactCount > 0
                  ? `${contactCount} active contacts in logbook`
                  : 'Log contacts on the main page to see live projected score'}
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="settings-actions">
        {error && <p className="settings-error">{error}</p>}
        {message && <p className="settings-success">{message}</p>}
        <button type="button" className="btn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Station Settings'}
        </button>
      </div>
    </div>
  );
}

export default StationSettingsPanel;
