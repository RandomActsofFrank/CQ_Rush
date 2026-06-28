import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Admin.css';
import { apiFetch } from './api';
import {
  ARRL_CLASS_PLACEHOLDER,
  validateCallsign,
  validateClass,
  validateLocation
} from './fieldDayRules';
import StationSettingsPanel from './StationSettingsPanel';
import SecuritySettingsPanel from './SecuritySettingsPanel';
import CabrilloExportPanel from './CabrilloExportPanel';
import OneByOneCachePanel from './OneByOneCachePanel';
import AdminLogin from './AdminLogin';
import { useAuth } from './AuthContext';

function Admin() {
  const { clubName, loginAdmin, adminAccessGranted, status } = useAuth();
  const getEditorOperator = () => (
    status.authMode === 'user_accounts' && status.userCallsign
      ? status.userCallsign
      : 'Admin'
  );
  const [activeTab, setActiveTab] = useState('logbook');
  const [contacts, setContacts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showCabrilloExport, setShowCabrilloExport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedContactHistory, setSelectedContactHistory] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [activeOperators, setActiveOperators] = useState([]);
  const [operatorsLoading, setOperatorsLoading] = useState(false);
  const [operatorsError, setOperatorsError] = useState('');
  const [lookupRefreshing, setLookupRefreshing] = useState(false);
  const [lookupRefreshMessage, setLookupRefreshMessage] = useState('');
  const [lookupRefreshError, setLookupRefreshError] = useState('');
  const [refreshingContactId, setRefreshingContactId] = useState(null);

  // Frequency bands and modes (same as main app)
  const frequencyBands = [
    { value: '160', label: '160' },
    { value: '80', label: '80' },
    { value: '40', label: '40' },
    { value: '20', label: '20' },
    { value: '15', label: '15' },
    { value: '10', label: '10' },
    { value: '6', label: '6 (50 MHz)' },
    { value: '2', label: '2 (144 MHz)' },
    { value: '1.25', label: '1.25 (222 MHz)' },
    { value: '70cm', label: '70 cm (432 MHz)' },
    { value: '33cm', label: '33 cm (902 MHz)' },
    { value: '23cm', label: '23 cm (1.3 GHz)' },
    { value: '13cm', label: '13 cm (2.3 GHz)' },
    { value: '9cm', label: '9 cm (3.5 GHz)' },
    { value: '6cm', label: '6 cm (5.8 GHz)' },
    { value: '3cm', label: '3 cm (10 GHz)' },
    { value: 'satellite', label: 'Satellite' },
    { value: 'other', label: 'Other' }
  ];

  const modes = ['CW', 'Phone', 'Digital'];

  // Load contacts on component mount and when showDeleted changes
  useEffect(() => {
    loadContacts();
  }, [showDeleted]);

  useEffect(() => {
    if (activeTab !== 'logbook' || !adminAccessGranted) {
      return undefined;
    }

    loadActiveOperators();
    const pollInterval = setInterval(loadActiveOperators, 10000);
    return () => clearInterval(pollInterval);
  }, [activeTab, adminAccessGranted]);

  const loadActiveOperators = async () => {
    setOperatorsLoading(true);
    setOperatorsError('');
    try {
      const response = await apiFetch('/api/active-operators');
      if (response.ok) {
        setActiveOperators(await response.json());
      } else {
        setActiveOperators([]);
        setOperatorsError('Unable to load active operators.');
      }
    } catch (error) {
      console.error('Error loading active operators:', error);
      setActiveOperators([]);
      setOperatorsError('Unable to load active operators.');
    } finally {
      setOperatorsLoading(false);
    }
  };

  const handleRefreshContactLookup = async (contactId, callsign) => {
    setLookupRefreshError('');
    setLookupRefreshMessage('');
    setRefreshingContactId(contactId);

    try {
      const response = await apiFetch(`/api/contacts/${contactId}/refresh-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: getEditorOperator() })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Unable to refresh lookup for ${callsign}.`);
      }

      if (data.status === 'updated') {
        setContacts((prev) => prev.map((contact) => (
          contact.id === contactId ? { ...contact, name: data.name } : contact
        )));
        setLookupRefreshMessage(`Updated ${callsign} → ${data.name}.`);
      } else if (data.status === 'unchanged') {
        setLookupRefreshMessage(`${callsign} already has lookup name "${data.name}".`);
      } else {
        setLookupRefreshMessage(`No name found to save for ${callsign}.`);
      }
    } catch (error) {
      setLookupRefreshError(error.message || `Unable to refresh lookup for ${callsign}.`);
    } finally {
      setRefreshingContactId(null);
    }
  };

  const handleRefreshLookups = async (missingOnly) => {
    if (!missingOnly) {
      const confirmed = window.confirm(
        'Re-run name lookup for every visible log entry? This may take a while.'
      );
      if (!confirmed) {
        return;
      }
    }

    setLookupRefreshing(true);
    setLookupRefreshError('');
    setLookupRefreshMessage('');

    try {
      const response = await apiFetch('/api/contacts/refresh-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missingOnly,
          includeDeleted: showDeleted,
          operator: getEditorOperator()
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to refresh logbook lookup data.');
      }

      await loadContacts();
      setLookupRefreshMessage(data.message || 'Logbook lookup refresh complete.');
    } catch (error) {
      setLookupRefreshError(error.message || 'Unable to refresh logbook lookup data.');
    } finally {
      setLookupRefreshing(false);
    }
  };

  const missingNameCount = contacts.filter(
    (contact) => !contact.name || !String(contact.name).trim()
  ).length;

  const handleRemoveActiveOperator = async (callsign) => {
    if (!window.confirm(`Remove ${callsign} from active operators?`)) {
      return;
    }

    try {
      const response = await apiFetch(`/api/active-operators/${encodeURIComponent(callsign)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadActiveOperators();
      }
    } catch (error) {
      console.error('Error removing active operator:', error);
    }
  };

  const loadContacts = async () => {
    try {
      const endpoint = showDeleted ? '/api/contacts/all' : '/api/contacts';
      const response = await apiFetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const loadContactHistory = async (contactId) => {
    try {
      const response = await apiFetch(`/api/contacts/${contactId}/history`);
      if (response.ok) {
        const history = await response.json();
        setSelectedContactHistory(history);
        setSelectedContactId(contactId);
        setShowHistory(true);
      } else {
        const errorText = await response.text();
        console.error('Error loading contact history:', response.status, errorText);
        alert('Unable to load edit history. Please try again.');
      }
    } catch (error) {
      console.error('Error loading contact history:', error);
      alert('Unable to load edit history. Please try again.');
    }
  };

  const handleEdit = (contact) => {
    setEditingId(contact.id);
    setEditData({
      callsign: contact.callsign,
      name: contact.name || '',
      frequency: contact.frequency,
      mode: contact.mode,
      classSent: contact.classSent,
      locationReceived: contact.locationReceived,
      notes: contact.notes
    });
  };

  const handleSave = async (contactId) => {
    console.log('Saving contact:', contactId, 'with data:', editData);
    
    try {
      const response = await apiFetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...editData,
          operator: getEditorOperator()
        }),
      });

      console.log('Save response status:', response.status);

      if (response.ok) {
        const updatedContact = await response.json();
        console.log('Updated contact:', updatedContact);
        
        // Update local state
        setContacts(prev => prev.map(contact => 
          contact.id === contactId 
            ? { ...contact, ...updatedContact }
            : contact
        ));
        setEditingId(null);
        setEditData({});
        console.log('Contact saved successfully');
      } else {
        const errorData = await response.text();
        console.error('Save failed with status:', response.status, 'Error:', errorData);
        alert('Failed to save contact. Please try again.');
      }
    } catch (error) {
      console.error('Error updating contact:', error);
      alert('Error saving contact. Please check the console for details.');
    }
  };

  const handleDelete = async (contactId) => {
    try {
      const response = await apiFetch(`/api/contacts/${contactId}?operator=${encodeURIComponent(getEditorOperator())}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Update local state to mark as deleted
        setContacts(prev => prev.map(contact => 
          contact.id === contactId 
            ? { ...contact, deleted: 'Y' }
            : contact
        ));
        setShowDeleteConfirm(false);
        setDeleteId(null);
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Do you really want to delete all entries?')) {
      return;
    }

    if (!window.confirm('Are you really really sure you want to delete all entries?')) {
      return;
    }

    try {
      const response = await apiFetch('/api/contacts/clear', {
        method: 'DELETE'
      });

      if (response.ok) {
        setContacts([]);
      } else {
        alert('Failed to delete all log entries.');
      }
    } catch (error) {
      console.error('Error deleting all contacts:', error);
      alert('Error deleting all log entries.');
    }
  };

  const handleRestore = async (contactId) => {
    try {
      const response = await apiFetch(`/api/contacts/${contactId}/restore`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operator: getEditorOperator()
        }),
      });

      if (response.ok) {
        // Update local state to mark as restored
        setContacts(prev => prev.map(contact => 
          contact.id === contactId 
            ? { ...contact, deleted: 'N' }
            : contact
        ));
      }
    } catch (error) {
      console.error('Error restoring contact:', error);
    }
  };

  const confirmDelete = (contactId) => {
    setDeleteId(contactId);
    setShowDeleteConfirm(true);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatHistoryAction = (action) => {
    const actionMap = {
      'created': 'Created',
      'updated': 'Updated',
      'deleted': 'Soft Deleted',
      'restored': 'Restored'
    };
    return actionMap[action] || action;
  };

  const getChangedFields = (oldData, newData) => {
    if (!oldData || !newData) return [];
    
    const fields = ['callsign', 'name', 'frequency', 'mode', 'classSent', 'locationReceived', 'notes'];
    const changes = [];
    
    fields.forEach(field => {
      if (oldData[field] !== newData[field]) {
        changes.push({
          field,
          old: oldData[field],
          new: newData[field]
        });
      }
    });
    
    return changes;
  };

  if (!adminAccessGranted) {
    if (status.authMode === 'user_accounts') {
      return (
        <div className="admin-container">
          <div className="admin-content admin-access-denied">
            <h2>Admin Access Required</h2>
            <p>Your account does not have admin privileges.</p>
            <Link to="/" className="btn-secondary">Back to Logbook</Link>
          </div>
        </div>
      );
    }

    return <AdminLogin clubName={clubName} onLogin={loginAdmin} />;
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Admin</h1>
        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-tab ${activeTab === 'logbook' ? 'active' : ''}`}
            onClick={() => setActiveTab('logbook')}
          >
            Logbook
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Station Settings
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === 'onebyone' ? 'active' : ''}`}
            onClick={() => setActiveTab('onebyone')}
          >
            1×1 Cache
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            Security &amp; Branding
          </button>
        </div>
      </div>

      <div className="admin-body">
      {activeTab === 'security' ? (
        <div className="admin-content admin-content-settings">
          <SecuritySettingsPanel />
        </div>
      ) : activeTab === 'settings' ? (
        <div className="admin-content admin-content-settings">
          <StationSettingsPanel contactCount={contacts.filter((c) => c.deleted !== 'Y').length} />
        </div>
      ) : activeTab === 'onebyone' ? (
        <div className="admin-content admin-content-settings">
          <OneByOneCachePanel />
        </div>
      ) : (
      <>
      <div className="admin-logbook-toolbar">
        <div className="admin-controls">
          <button
            type="button"
            className="btn-export-cabrillo-header"
            onClick={() => setShowCabrilloExport(true)}
          >
            Export Logs
          </button>
          <button
            className={`btn-toggle ${showDeleted ? 'active' : ''}`}
            onClick={() => setShowDeleted(!showDeleted)}
          >
            {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleRefreshLookups(true)}
            disabled={lookupRefreshing || contacts.length === 0}
            title="Fill in blank names from live lookup or local cache"
          >
            {lookupRefreshing ? 'Refreshing…' : `Refresh Missing Names${missingNameCount ? ` (${missingNameCount})` : ''}`}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleRefreshLookups(false)}
            disabled={lookupRefreshing || contacts.length === 0}
            title="Re-run lookup for every visible log entry"
          >
            Refresh All Names
          </button>
        </div>
      </div>

      {(lookupRefreshError || lookupRefreshMessage) && (
        <div className="admin-lookup-refresh-status">
          {lookupRefreshError && <p className="admin-inline-error">{lookupRefreshError}</p>}
          {lookupRefreshMessage && <p className="admin-inline-success">{lookupRefreshMessage}</p>}
        </div>
      )}
      
      <div className="admin-content admin-active-operators-panel">
        <div className="admin-active-operators-header">
          <div>
            <h2>Active Operators</h2>
            <p className="admin-active-operators-note">
              Remove operators who forgot to log out. The list refreshes every 10 seconds.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={loadActiveOperators}
            disabled={operatorsLoading}
          >
            {operatorsLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {operatorsError && (
          <p className="admin-inline-error">{operatorsError}</p>
        )}

        {!operatorsError && activeOperators.length === 0 ? (
          <p className="admin-active-operators-empty">No active operators</p>
        ) : !operatorsError ? (
          <table className="admin-table admin-active-operators-table">
            <thead>
              <tr>
                <th>Callsign</th>
                <th>Band</th>
                <th>Mode</th>
                <th>Conflict</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeOperators.map((op) => (
                <tr key={op.callsign} className={op.duplicateUser === 'Y' ? 'operator-conflict-row' : ''}>
                  <td>{op.callsign}</td>
                  <td>{op.frequency || '—'}</td>
                  <td>{op.mode || '—'}</td>
                  <td>{op.duplicateUser === 'Y' ? 'Yes' : 'No'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => handleRemoveActiveOperator(op.callsign)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="admin-content">
        <div className="logbook-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Callsign</th>
                <th>Name</th>
                <th>Band</th>
                <th>Mode</th>
                <th>Class</th>
                <th>Location</th>
                <th>Operator</th>
                <th>Notes</th>
                <th>Created By</th>
                <th>Last Edited</th>
                {showDeleted && <th>Status</th>}
                <th className="admin-table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <td>{formatTime(contact.timestamp)}</td>
                  <td>
                    {editingId === contact.id ? (
                      <div className="edit-input-container">
                        <input
                          type="text"
                          value={editData.callsign || ''}
                          onChange={(e) => setEditData(prev => ({
                            ...prev,
                            callsign: e.target.value.toUpperCase()
                          }))}
                          className={`edit-input edit-callsign-input ${editData.callsign && !validateCallsign(editData.callsign) ? 'invalid-callsign' : ''}`}
                          placeholder="Callsign"
                          maxLength={12}
                        />
                        {editData.callsign && !validateCallsign(editData.callsign) && (
                          <div className="invalid-callsign-text">Invalid callsign</div>
                        )}
                      </div>
                    ) : (
                      contact.callsign
                    )}
                  </td>
                  <td>
                    {editingId === contact.id ? (
                      <input
                        type="text"
                        value={editData.name || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                        className="edit-input"
                        placeholder="Operator name"
                      />
                    ) : (
                      contact.name
                    )}
                  </td>
                  <td>
                    {editingId === contact.id ? (
                      <select
                        value={editData.frequency || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, frequency: e.target.value }))}
                        className="edit-select"
                      >
                        <option value="">Select Band</option>
                        {frequencyBands.map(band => (
                          <option key={band.value} value={band.label}>{band.label}</option>
                        ))}
                      </select>
                    ) : (
                      contact.frequency
                    )}
                  </td>
                  <td>
                    {editingId === contact.id ? (
                      <select
                        value={editData.mode || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, mode: e.target.value }))}
                        className="edit-select"
                      >
                        <option value="">Select Mode</option>
                        {modes.map(mode => (
                          <option key={mode} value={mode}>{mode}</option>
                        ))}
                      </select>
                    ) : (
                      contact.mode
                    )}
                  </td>
                  <td>
                    {editingId === contact.id ? (
                      <div className="edit-input-container">
                        <input
                          type="text"
                          value={editData.classSent || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, classSent: e.target.value }))}
                          className={`edit-input ${editData.classSent && !validateClass(editData.classSent) ? 'invalid-class' : ''}`}
                          placeholder={ARRL_CLASS_PLACEHOLDER}
                        />
                        {editData.classSent && !validateClass(editData.classSent) && (
                          <div className="invalid-class-text">Invalid class format</div>
                        )}
                      </div>
                    ) : (
                      contact.classSent
                    )}
                  </td>
                  <td>
                    {editingId === contact.id ? (
                      <div className="edit-input-container">
                        <input
                          type="text"
                          value={editData.locationReceived || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, locationReceived: e.target.value }))}
                          className={`edit-input ${editData.locationReceived && !validateLocation(editData.locationReceived) ? 'invalid-location' : ''}`}
                          placeholder="e.g., AZ, EMA, DX"
                        />
                        {editData.locationReceived && !validateLocation(editData.locationReceived) && (
                          <div className="invalid-location-text">Invalid location</div>
                        )}
                      </div>
                    ) : (
                      contact.locationReceived
                    )}
                  </td>
                  <td>{contact.operator || contact.createdBy || '-'}</td>
                  <td>
                    {editingId === contact.id ? (
                      <input
                        type="text"
                        value={editData.notes || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                        className="edit-input"
                      />
                    ) : (
                      contact.notes
                    )}
                  </td>
                  <td>{contact.createdBy || 'Unknown'}</td>
                  <td>
                    {contact.lastEditedBy ? (
                      <div>
                        <div>{contact.lastEditedBy}</div>
                        <div style={{fontSize: '10px', color: '#666'}}>
                          {contact.lastEditedAt ? formatTime(contact.lastEditedAt) : ''}
                        </div>
                      </div>
                    ) : (
                      'Never'
                    )}
                  </td>
                  {showDeleted && (
                    <td className={`status-cell ${contact.deleted === 'Y' ? 'deleted' : 'active'}`}>
                      {contact.deleted === 'Y' ? 'Deleted' : 'Active'}
                    </td>
                  )}
                  <td className="admin-table-actions-col">
                    <div className="action-buttons">
                    {editingId === contact.id ? (
                      <>
                        <button
                          className="btn-save"
                          onClick={() => handleSave(contact.id)}
                          disabled={
                            !validateCallsign(editData.callsign) ||
                            !editData.frequency || 
                            !editData.mode || 
                            !editData.classSent || 
                            !editData.locationReceived ||
                            !validateClass(editData.classSent) ||
                            !validateLocation(editData.locationReceived)
                          }
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn-cancel"
                          onClick={() => {
                            setEditingId(null);
                            setEditData({});
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn-history"
                          onClick={() => loadContactHistory(contact.id)}
                          title="View Edit History"
                        >
                          History
                        </button>
                        <button
                          type="button"
                          className="btn-lookup-refresh"
                          onClick={() => handleRefreshContactLookup(contact.id, contact.callsign)}
                          disabled={refreshingContactId === contact.id || lookupRefreshing}
                          title="Refresh name from callsign lookup"
                        >
                          {refreshingContactId === contact.id ? '…' : 'Lookup'}
                        </button>
                        {contact.deleted === 'Y' ? (
                          <button
                            className="btn-restore"
                            onClick={() => handleRestore(contact.id)}
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              className="btn-edit"
                              onClick={() => handleEdit(contact)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-delete"
                              onClick={() => confirmDelete(contact.id)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-logbook-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleRefreshLookups(true)}
            disabled={lookupRefreshing || contacts.length === 0}
          >
            {lookupRefreshing ? 'Refreshing…' : 'Refresh Missing Names'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleRefreshLookups(false)}
            disabled={lookupRefreshing || contacts.length === 0}
          >
            Refresh All Names
          </button>
          <button
            type="button"
            className="btn-delete-all"
            onClick={handleDeleteAll}
            disabled={contacts.length === 0}
          >
            Delete All Log Entries
          </button>
          <p className="admin-logbook-footer-note">
            Refresh names uses live lookup (Callook, Canadian, 1×1) and falls back to the local
            callsign cache when offline. Permanently removing every contact cannot be undone.
          </p>
        </div>
      </div>
      </>
      )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Soft Delete</h3>
            <p>Are you sure you want to mark this log entry as deleted? The entry will be hidden from the main view but can be restored later.</p>
            <div className="modal-buttons">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteId(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-delete"
                onClick={() => handleDelete(deleteId)}
              >
                Mark as Deleted
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="modal-overlay">
          <div className="modal-content history-modal">
            <div className="history-header">
              <h3>Contact Edit History</h3>
              <button
                className="popup-close-btn"
                onClick={() => {
                  setShowHistory(false);
                  setSelectedContactHistory([]);
                  setSelectedContactId(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="history-content">
              {selectedContactHistory.length === 0 ? (
                <p>No edit history available for this contact.</p>
              ) : (
                <div className="history-list">
                  {selectedContactHistory.map((change) => (
                    <div key={change.id || change.changeId} className="history-item">
                      <div className="history-item-header">
                        <span className="history-action">{formatHistoryAction(change.action)}</span>
                        <span className="history-timestamp">{formatTime(change.timestamp)}</span>
                        <span className="history-operator">by {change.operator}</span>
                      </div>
                      {change.action === 'updated' && change.oldData && change.newData && (
                        <div className="history-changes">
                          {getChangedFields(change.oldData, change.newData).map((fieldChange, fieldIndex) => (
                            <div key={fieldIndex} className="field-change">
                              <span className="field-name">{fieldChange.field}:</span>
                              <span className="field-old">{fieldChange.old || '(empty)'}</span>
                              <span className="field-arrow">→</span>
                              <span className="field-new">{fieldChange.new || '(empty)'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {change.action === 'created' && (
                        <div className="history-created">
                          <span>Contact created with initial data</span>
                        </div>
                      )}
                      {change.action === 'deleted' && (
                        <div className="history-deleted">
                          <span>Contact marked as deleted</span>
                        </div>
                      )}
                      {change.action === 'restored' && (
                        <div className="history-restored">
                          <span>Contact restored from deleted status</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCabrilloExport && (
        <CabrilloExportPanel
          contacts={contacts}
          clubName={clubName}
          onClose={() => setShowCabrilloExport(false)}
        />
      )}
    </div>
  );
}

export default Admin; 