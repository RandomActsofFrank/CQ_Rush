const API_BASE = process.env.REACT_APP_API_URL || '';

export function apiFetch(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.headers || {})
    }
  });
}

export async function fetchAuthStatus() {
  const response = await apiFetch('/api/auth/status');
  if (!response.ok) {
    throw new Error('Unable to load auth status');
  }
  return response.json();
}

export async function loginSite(credentials) {
  const body = typeof credentials === 'string'
    ? { password: credentials }
    : credentials;

  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 409 && data.sessionConflict) {
    const error = new Error(data.error || 'Already signed in on another device');
    error.sessionConflict = true;
    throw error;
  }

  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  return data;
}

export async function loginAdmin(password) {
  const response = await apiFetch('/api/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Admin login failed');
  }

  return response.json();
}

export async function logoutSite(callsign) {
  const body = callsign ? { callsign: String(callsign).trim().toUpperCase() } : {};
  const response = await apiFetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error('Unable to log out');
  }
}

export async function logoutAdmin() {
  await apiFetch('/api/auth/admin/logout', { method: 'POST' });
}

export async function changeUserPassword(currentPassword, newPassword) {
  const response = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Unable to change password');
  }

  return response.json();
}

export async function fetchAppConfig() {
  const response = await apiFetch('/api/app-config');
  if (!response.ok) {
    throw new Error('Unable to load security settings');
  }
  return response.json();
}

export async function saveAppConfig(config) {
  const response = await apiFetch('/api/app-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Unable to save security settings');
  }

  return response.json();
}

export async function fetchContests() {
  const response = await apiFetch('/api/contests');
  if (!response.ok) {
    throw new Error('Unable to load contests');
  }
  return response.json();
}

export async function fetchActiveContest() {
  const response = await apiFetch('/api/contests/active');
  if (!response.ok) {
    throw new Error('Unable to load active contest');
  }
  return response.json();
}

export async function setActiveContest(slug) {
  const response = await apiFetch('/api/contests/active', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Unable to switch contest');
  }

  return response.json();
}

export async function fetchUsers() {
  const response = await apiFetch('/api/users');
  if (!response.ok) {
    throw new Error('Unable to load users');
  }
  return response.json();
}

export async function createUserAccount(user) {
  const response = await apiFetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Unable to create user');
  }

  return response.json();
}

export async function updateUserAccount(callsign, updates) {
  const response = await apiFetch(`/api/users/${encodeURIComponent(callsign)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Unable to update user');
  }

  return response.json();
}

export async function deleteUserAccount(callsign) {
  const response = await apiFetch(`/api/users/${encodeURIComponent(callsign)}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Unable to delete user');
  }
}
