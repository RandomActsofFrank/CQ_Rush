import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';

function formatTimestamp(value) {
  if (!value) {
    return 'Never';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function OneByOneCachePanel() {
  const [status, setStatus] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadStatus = useCallback(async () => {
    setError('');
    try {
      const response = await apiFetch('/api/one-by-one/cache/status');
      if (!response.ok) {
        throw new Error('Unable to load 1×1 cache status.');
      }
      const data = await response.json();
      setStatus(data);
      setRefreshing(data.running || data.status === 'running');
      setStartDate((current) => current || data.startDate || data.suggestedStartDate || '');
      setEndDate((current) => current || data.endDate || data.suggestedEndDate || '');
    } catch (loadError) {
      setError(loadError.message || 'Unable to load 1×1 cache status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!refreshing) {
      return undefined;
    }

    const timer = setInterval(loadStatus, 3000);
    return () => clearInterval(timer);
  }, [refreshing, loadStatus]);

  const handleRefresh = async () => {
    setError('');
    setMessage('');

    if (!startDate || !endDate) {
      setError('Choose a start and end date for the 1×1 search range.');
      return;
    }

    if (startDate > endDate) {
      setError('Start date must be on or before the end date.');
      return;
    }

    try {
      const response = await apiFetch('/api/one-by-one/cache/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate })
      });
      const data = await response.json();

      if (response.status === 409) {
        setMessage(data.error || 'A refresh is already running.');
        setRefreshing(true);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Unable to start 1×1 cache refresh.');
      }

      setMessage(data.message || 'Refresh started.');
      setRefreshing(true);
      await loadStatus();
    } catch (refreshError) {
      setError(refreshError.message || 'Unable to start 1×1 cache refresh.');
    }
  };

  return (
    <section className="admin-one-by-one-panel">
      <div className="admin-one-by-one-header">
        <div>
          <h2>1×1 Special Event Cache</h2>
          <p className="admin-one-by-one-note">
            Search the official 1×1 database by date range, then download each reservation&apos;s
            detail page into the local database. Operator name and grid come from the requestor
            call via Callook. Defaults to two days before and after Field Day (4th full June weekend).
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleRefresh}
          disabled={loading || refreshing}
        >
          {refreshing ? 'Refreshing…' : 'Refresh 1×1 Cache'}
        </button>
      </div>

      <div className="admin-one-by-one-dates">
        <label>
          Start date (UTC)
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            disabled={refreshing}
          />
        </label>
        <label>
          End date (UTC)
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            disabled={refreshing}
          />
        </label>
      </div>

      {loading && <p>Loading cache status…</p>}
      {error && <p className="admin-inline-error">{error}</p>}
      {message && <p className="admin-inline-success">{message}</p>}

      {status && (
        <div className="admin-one-by-one-stats">
          <div><span>Status</span><strong>{status.running ? 'Running' : status.status}</strong></div>
          <div><span>Cached reservations</span><strong>{status.reservationCount ?? 0}</strong></div>
          <div><span>Last range</span><strong>{status.startDate && status.endDate ? `${status.startDate} – ${status.endDate}` : '—'}</strong></div>
          <div><span>Last refreshed</span><strong>{formatTimestamp(status.refreshedAt)}</strong></div>
          {status.detailCount != null && (
            <div><span>Records found</span><strong>{status.detailCount}</strong></div>
          )}
          {status.savedReservations != null && (
            <div><span>Saved this run</span><strong>{status.savedReservations}</strong></div>
          )}
          {status.errors ? (
            <div><span>Errors</span><strong>{status.errors}</strong></div>
          ) : null}
        </div>
      )}

      {status?.message && (
        <p className="admin-one-by-one-message">{status.message}</p>
      )}
    </section>
  );
}

export default OneByOneCachePanel;
