import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { apiFetch } from './api';
import {
  calculateQsoPoints,
  calculateScoreBreakdown,
  calculateProjectedScore,
  DEFAULT_STATION_SETTINGS
} from './fieldDayRules';
import { getEntryClubName } from './branding';
import { getContestDisplayTitle } from './contests/registry';
import AppFooter from './AppFooter';
import ArrlSectionsMap from './ArrlSectionsMap';

const DISPLAY_THEME_KEY = 'hamlog-display-dark-mode';
const CONTACT_ROW_HEIGHT = 27;
const CONTACTS_PANEL_CHROME = 72;

function formatUTCTime(timestamp) {
  const date = new Date(timestamp);
  return date.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
}

function formatCurrentDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatCurrentTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function formatUtcDateTime(date) {
  const utcDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
  const utcTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  });
  return `${utcDate} ${utcTime}`;
}

function readDarkModePreference() {
  const stored = localStorage.getItem(DISPLAY_THEME_KEY);
  if (stored === 'light') return false;
  if (stored === 'dark') return true;
  return true;
}

function PublicDisplay() {
  const [contacts, setContacts] = useState([]);
  const [activeOperators, setActiveOperators] = useState([]);
  const [stationSettings, setStationSettings] = useState(DEFAULT_STATION_SETTINGS);
  const [clubName, setClubName] = useState('');
  const [activeContestSlug, setActiveContestSlug] = useState('field-day');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [darkMode, setDarkMode] = useState(readDarkModePreference);
  const [visibleContactCount, setVisibleContactCount] = useState(12);
  const contactsPanelRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(DISPLAY_THEME_KEY, darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [contactsRes, operatorsRes, settingsRes, statusRes] = await Promise.all([
          apiFetch('/api/contacts'),
          apiFetch('/api/active-operators'),
          apiFetch('/api/station-settings'),
          apiFetch('/api/auth/status')
        ]);

        if (contactsRes.ok) {
          setContacts(await contactsRes.json());
        }
        if (operatorsRes.ok) {
          setActiveOperators(await operatorsRes.json());
        }
        if (settingsRes.ok) {
          setStationSettings(await settingsRes.json());
        }
        if (statusRes.ok) {
          const status = await statusRes.json();
          setClubName(getEntryClubName(status.clubName || ''));
          if (status.activeContest?.slug) {
            setActiveContestSlug(status.activeContest.slug);
          }
        }
      } catch (error) {
        console.error('Error loading public display data:', error);
      }
    };

    loadData();
    const pollInterval = setInterval(loadData, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    const panel = contactsPanelRef.current;
    if (!panel) return undefined;

    const updateVisibleCount = () => {
      const availableHeight = panel.clientHeight - CONTACTS_PANEL_CHROME;
      const count = Math.max(4, Math.floor(availableHeight / CONTACT_ROW_HEIGHT));
      setVisibleContactCount(count);
    };

    updateVisibleCount();
    const observer = new ResizeObserver(updateVisibleCount);
    observer.observe(panel);
    window.addEventListener('resize', updateVisibleCount);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateVisibleCount);
    };
  }, []);

  const qsoPoints = calculateQsoPoints(contacts);
  const scoreBreakdown = calculateScoreBreakdown(contacts);
  const projectedScore = calculateProjectedScore(qsoPoints, stationSettings);
  const hasStationConfig = Boolean(stationSettings.entryClass);
  const recentContacts = contacts.slice(0, visibleContactCount);
  const mapTitle = getContestDisplayTitle(activeContestSlug, 'Sections Progress');
  const theme = darkMode ? 'dark' : 'light';

  return (
    <div className={`public-display ${darkMode ? 'public-display-dark' : 'public-display-light'}`}>
      <header className="public-display-header">
        <label className="public-display-theme-toggle">
          <input
            type="checkbox"
            checked={darkMode}
            onChange={(event) => setDarkMode(event.target.checked)}
          />
          Dark mode
        </label>

        <div className="public-display-header-center">
          <span className="public-display-header-title">{mapTitle}</span>
          <span className="public-display-header-separator">|</span>
          <span className="public-display-header-datetime">
            <span className="public-display-header-local">
              {formatCurrentDate(currentTime)} {formatCurrentTime(currentTime)} local
            </span>
            <span className="public-display-header-separator">|</span>
            <span className="public-display-header-utc">
              {formatUtcDateTime(currentTime)} UTC
            </span>
          </span>
        </div>

        <div className="public-display-header-spacer" aria-hidden="true" />
      </header>

      <div className="public-display-body">
        <aside className="public-display-sidebar">
          <section className="public-display-panel score-panel">
            {clubName && (
              <div className="public-display-club-name">{clubName}</div>
            )}
            <h2>{hasStationConfig ? 'Projected Score' : 'QSO Points'}</h2>
            <div className="public-display-score">
              {hasStationConfig ? projectedScore.finalScore : qsoPoints}
            </div>
            <div className="public-display-score-detail">
              Phone: {scoreBreakdown.phone} | CW: {scoreBreakdown.cw} | Digital: {scoreBreakdown.digital}
            </div>
            {hasStationConfig && (
              <div className="public-display-score-detail">
                {qsoPoints} QSO × {projectedScore.powerMultiplier} + {projectedScore.bonusPoints} bonus
              </div>
            )}
          </section>

          <section className="public-display-panel">
            <h2>Active Operators ({activeOperators.length})</h2>
            {activeOperators.length === 0 ? (
              <p className="public-display-empty">No active operators</p>
            ) : (
              <ul className="public-display-operators">
                {activeOperators.map((op) => (
                  <li key={op.callsign} className={op.duplicateUser === 'Y' ? 'conflict' : ''}>
                    <span className="operator-callsign">{op.callsign}</span>
                    <span className="operator-band">{op.frequency}</span>
                    <span className="operator-mode">
                      {op.mode === 'Phone' ? 'PH' : op.mode === 'Digital' ? 'DIG' : 'CW'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            ref={contactsPanelRef}
            className="public-display-panel public-display-contacts"
          >
            <h2>
              Recent Contacts ({contacts.length}
              {contacts.length > recentContacts.length ? `, showing ${recentContacts.length}` : ''})
            </h2>
            {recentContacts.length === 0 ? (
              <p className="public-display-empty">No contacts logged yet</p>
            ) : (
              <div className="public-display-contacts-table">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Call</th>
                      <th>Band</th>
                      <th>Mode</th>
                      <th>Loc</th>
                      <th>Op</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentContacts.map((contact) => (
                      <tr key={contact.id}>
                        <td>{formatUTCTime(contact.timestamp).replace(' UTC', '')}</td>
                        <td><strong>{contact.callsign}</strong></td>
                        <td>{contact.frequency}</td>
                        <td>{contact.mode === 'Phone' ? 'PH' : contact.mode === 'Digital' ? 'DIG' : 'CW'}</td>
                        <td>{contact.locationReceived}</td>
                        <td>{contact.operator || contact.createdBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </aside>

        <main className="public-display-map">
          <ArrlSectionsMap
            contacts={contacts}
            showOpenLink={false}
            theme={theme}
            fillHeight
            embedded
          />
          <AppFooter className="public-display-map-footer" />
        </main>
      </div>
    </div>
  );
}

export default PublicDisplay;
