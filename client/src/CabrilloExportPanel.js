import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api';
import { normalizeStationSettings } from './fieldDayRules';
import { copyToClipboard } from './clipboard';
import {
  ARRL_FD_ENTRY_URL,
  buildArrlEntrySummary,
  downloadCabrilloFile,
  formatEntrySummaryText,
  generateCabrilloLog,
  validateCabrilloExport
} from './cabrilloExport';
import {
  LOTW_LOGIN_URL,
  LOTW_UPLOAD_URL,
  QRZ_LOGBOOK_URL,
  downloadAdifFile,
  generateAdifLog
} from './logExport';

function SummaryField({ label, value, onCopy }) {
  return (
    <div className="cabrillo-summary-field">
      <span className="cabrillo-summary-label">{label}</span>
      <div className="cabrillo-summary-value-row">
        <code>{value || '—'}</code>
        {value && (
          <button type="button" className="btn-copy-inline" onClick={() => onCopy(value)}>
            Copy
          </button>
        )}
      </div>
    </div>
  );
}

function CabrilloExportPanel({ contacts, clubName, onClose }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await apiFetch('/api/station-settings');
        if (!response.ok) {
          throw new Error('Unable to load station settings.');
        }
        setSettings(normalizeStationSettings(await response.json()));
      } catch (loadError) {
        setError(loadError.message || 'Unable to load station settings.');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const validation = useMemo(() => {
    if (!settings) {
      return null;
    }
    return validateCabrilloExport({ settings, contacts, clubName });
  }, [settings, contacts, clubName]);

  const summary = useMemo(() => {
    if (!settings) {
      return null;
    }
    return buildArrlEntrySummary({ contacts, settings, clubName });
  }, [settings, contacts, clubName]);

  const summaryText = useMemo(() => {
    if (!summary) {
      return '';
    }
    return formatEntrySummaryText(summary);
  }, [summary]);

  const exportDisabled = validation?.errors.length > 0;

  const copyText = async (text) => {
    setError('');
    try {
      await copyToClipboard(text);
      setMessage('Copied to clipboard.');
      setTimeout(() => setMessage(''), 2500);
    } catch (copyError) {
      setError(copyError.message || 'Unable to copy to clipboard.');
    }
  };

  const handleDownloadCabrillo = () => {
    setError('');
    setMessage('');

    try {
      const result = generateCabrilloLog({ contacts, settings, clubName });
      downloadCabrilloFile(result.content, result.callsign);
      setMessage(`Downloaded ${result.callsign}.log (${validation?.activeContactCount || 0} QSOs).`);
    } catch (downloadError) {
      setError(downloadError.message || 'Unable to generate Cabrillo file.');
    }
  };

  const handleDownloadAdif = () => {
    setError('');
    setMessage('');

    try {
      const result = generateAdifLog({ contacts, settings, clubName });
      downloadAdifFile(result.content, result.callsign);
      setMessage(`Downloaded ${result.callsign}.adi (${result.contactCount} QSOs).`);
    } catch (downloadError) {
      setError(downloadError.message || 'Unable to generate ADIF file.');
    }
  };

  const handleOpenArrlEntry = () => {
    if (summaryText) {
      sessionStorage.setItem('hamlog-fd-entry-summary', summaryText);
    }
    window.open(ARRL_FD_ENTRY_URL, '_blank', 'noopener,noreferrer');
  };

  const openExternal = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="cabrillo-modal-backdrop" onClick={onClose}>
        <div className="cabrillo-modal" onClick={(event) => event.stopPropagation()}>
          <p>Loading export settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cabrillo-modal-backdrop" onClick={onClose}>
      <div className="cabrillo-modal" onClick={(event) => event.stopPropagation()}>
        <div className="cabrillo-modal-header">
          <div>
            <h2>Log Export &amp; Upload</h2>
            <p className="cabrillo-modal-subtitle">
              Download contest and logbook files, then upload to ARRL Field Day, LoTW, or QRZ.
            </p>
          </div>
          <button type="button" className="cabrillo-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {validation?.errors.length > 0 && (
          <div className="cabrillo-alert cabrillo-alert-error">
            <strong>Fix before exporting:</strong>
            <ul>
              {validation.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {validation?.warnings.length > 0 && (
          <div className="cabrillo-alert cabrillo-alert-warning">
            <strong>Warnings:</strong>
            <ul>
              {validation.warnings.slice(0, 6).map((item) => (
                <li key={item}>{item}</li>
              ))}
              {validation.warnings.length > 6 && (
                <li>…and {validation.warnings.length - 6} more</li>
              )}
            </ul>
          </div>
        )}

        <section className="cabrillo-export-section">
          <h3>ARRL Field Day</h3>
          <p className="cabrillo-section-note">
            Cabrillo <code>.log</code> for the official Field Day entry and dupe-sheet attachment.
          </p>
          <div className="cabrillo-actions">
            <button
              type="button"
              className="btn-export-cabrillo"
              onClick={handleDownloadCabrillo}
              disabled={exportDisabled}
            >
              Download Cabrillo (.log)
            </button>
            <button type="button" className="btn-arrl-entry" onClick={handleOpenArrlEntry}>
              Open ARRL Entry Form
            </button>
            <button type="button" className="btn-copy-summary" onClick={() => copyText(summaryText)}>
              Copy Full Summary
            </button>
          </div>
        </section>

        <section className="cabrillo-export-section">
          <h3>Logbook of the World (LoTW)</h3>
          <p className="cabrillo-section-note">
            LoTW accepts signed <code>.TQ8</code> files. Download ADIF below, sign it with{' '}
            <a href="https://lotw.arrl.org/lotw-help/sgnupload/" target="_blank" rel="noopener noreferrer">
              TrustedQSL (TQSL)
            </a>
            {' '}to create a <code>.TQ8</code>, then upload.
          </p>
          <div className="cabrillo-actions">
            <button
              type="button"
              className="btn-export-adif"
              onClick={handleDownloadAdif}
              disabled={exportDisabled}
            >
              Download ADIF for LoTW (.adi)
            </button>
            <button
              type="button"
              className="btn-lotw-upload"
              onClick={() => openExternal(LOTW_UPLOAD_URL)}
            >
              Open LoTW Upload
            </button>
            <button
              type="button"
              className="btn-lotw-login"
              onClick={() => openExternal(LOTW_LOGIN_URL)}
            >
              Open LoTW Login
            </button>
          </div>
        </section>

        <section className="cabrillo-export-section">
          <h3>QRZ Logbook</h3>
          <p className="cabrillo-section-note">
            QRZ accepts ADIF (<code>.adi</code>) uploads directly in the logbook import tools.
          </p>
          <div className="cabrillo-actions">
            <button
              type="button"
              className="btn-export-adif"
              onClick={handleDownloadAdif}
              disabled={exportDisabled}
            >
              Download ADIF (.adi)
            </button>
            <button
              type="button"
              className="btn-qrz-logbook"
              onClick={() => openExternal(QRZ_LOGBOOK_URL)}
            >
              Open QRZ Logbook
            </button>
          </div>
        </section>

        {error && <p className="cabrillo-inline-error">{error}</p>}
        {message && <p className="cabrillo-inline-success">{message}</p>}

        {summary && (
          <div className="cabrillo-summary-grid">
            <section className="cabrillo-summary-section">
              <h3>Entry Information</h3>
              <p className="cabrillo-section-note">
                Use these values when filling out{' '}
                <a href={ARRL_FD_ENTRY_URL} target="_blank" rel="noopener noreferrer">
                  field-day.arrl.org/fdentry.php
                </a>
                . Cabrillo upload is for the contacts/dupe sheet attachment.
              </p>
              <SummaryField label="Call Used" value={summary.callUsed} onCopy={copyText} />
              <SummaryField label="Club / Individual or Group Name" value={summary.clubName} onCopy={copyText} />
              <SummaryField label="ARRL/RAC Section" value={summary.section} onCopy={copyText} />
              <SummaryField label="Operating Class" value={summary.operatingClass} onCopy={copyText} />
              <SummaryField label="Exchange Sent" value={summary.exchange} onCopy={copyText} />
              <SummaryField label="Power Multiplier" value={summary.powerMultiplier} onCopy={copyText} />
              <SummaryField label="Claimed Score" value={String(summary.claimedScore)} onCopy={copyText} />
            </section>

            <section className="cabrillo-summary-section">
              <h3>QSO Totals</h3>
              <div className="cabrillo-qso-totals">
                <div><span>Phone</span><strong>{summary.phoneQsos}</strong></div>
                <div><span>CW</span><strong>{summary.cwQsos}</strong></div>
                <div><span>Digital</span><strong>{summary.digitalQsos}</strong></div>
                <div><span>Total</span><strong>{summary.totalQsos}</strong></div>
              </div>
              <ul className="cabrillo-band-mode-list">
                {Object.entries(summary.qsoTotalsByBandMode)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([bandMode, count]) => (
                    <li key={bandMode}>
                      <span>{bandMode}</span>
                      <strong>{count}</strong>
                    </li>
                  ))}
              </ul>
            </section>

            <section className="cabrillo-summary-section">
              <h3>Operators &amp; Bonuses</h3>
              <SummaryField
                label="Operators"
                value={summary.operators.join(', ') || '(none logged)'}
                onCopy={copyText}
              />
              {summary.bonusLines.length > 0 ? (
                <ul className="cabrillo-bonus-list">
                  {summary.bonusLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="cabrillo-section-note">No bonus points selected in Station Settings.</p>
              )}
            </section>
          </div>
        )}

        <div className="cabrillo-footer-note">
          <p>
            A Cabrillo file is accepted in place of a dupe sheet but does <strong>not</strong> replace the
            official ARRL summary. ADIF exports include Field Day exchange data for LoTW (via TQSL signing)
            and direct QRZ import.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CabrilloExportPanel;
