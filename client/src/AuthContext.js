import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  fetchAuthStatus,
  loginSite as apiLoginSite,
  loginAdmin as apiLoginAdmin,
  logoutSite,
  logoutAdmin
} from './api';
import Login from './Login';
import { getEntryClubName, APP_NAME } from './branding';

const AuthContext = createContext(null);

const DEFAULT_STATUS = {
  clubName: '',
  authMode: 'shared_password',
  userAuthEnabled: false,
  siteLoginRequired: false,
  siteAuthenticated: true,
  adminLoginRequired: false,
  adminAuthenticated: false,
  sitePasswordSet: false,
  adminPasswordSet: false,
  userCallsign: null,
  userIsAdmin: false
};

export function AuthProvider({ children }) {
  const location = useLocation();
  const isPublicDisplay = location.pathname === '/display';
  const isPublicAbout = location.pathname === '/about';
  const isPublicRoute = isPublicDisplay || isPublicAbout;
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    const next = await fetchAuthStatus();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    refreshStatus()
      .catch(() => setStatus(DEFAULT_STATUS))
      .finally(() => setLoading(false));
  }, [refreshStatus]);

  useEffect(() => {
    if (
      loading
      || !status.siteAuthenticated
      || status.authMode !== 'user_accounts'
      || !status.userAuthEnabled
    ) {
      return undefined;
    }

    const interval = setInterval(() => {
      refreshStatus().catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, [
    loading,
    status.siteAuthenticated,
    status.authMode,
    status.userAuthEnabled,
    refreshStatus
  ]);

  const loginSite = async (credentials) => {
    await apiLoginSite(credentials);
    await refreshStatus();
  };

  const loginAdmin = async (password) => {
    await apiLoginAdmin(password);
    await refreshStatus();
  };

  const logout = async (callsign) => {
    setStatus((prev) => ({
      ...prev,
      siteAuthenticated: false,
      adminAuthenticated: false,
      userCallsign: null,
      userIsAdmin: false
    }));

    try {
      await logoutSite(callsign);
      await refreshStatus();
    } catch (error) {
      await refreshStatus();
      throw error;
    }
  };

  const logoutAdminSession = async () => {
    await logoutAdmin();
    await refreshStatus();
  };

  const siteAccessGranted = !status.siteLoginRequired || status.siteAuthenticated;

  const adminAccessGranted = status.authMode === 'user_accounts'
    ? (status.userCount === 0 || Boolean(status.siteAuthenticated && status.userIsAdmin))
    : (!status.adminLoginRequired || status.adminAuthenticated);

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p className="login-subtitle">Loading {APP_NAME}...</p>
        </div>
      </div>
    );
  }

  if (!siteAccessGranted && !isPublicRoute) {
    return (
      <Login
        clubName={getEntryClubName(status.clubName)}
        authMode={status.authMode}
        onLogin={loginSite}
      />
    );
  }

  const entryClubName = getEntryClubName(status.clubName);

  return (
    <AuthContext.Provider
      value={{
        status,
        clubName: entryClubName,
        refreshStatus,
        loginAdmin,
        logout,
        logoutAdminSession,
        adminAccessGranted,
        userAuthActive: status.authMode === 'user_accounts' && status.userAuthEnabled,
        loggedInUser: status.authMode === 'user_accounts'
          && status.userAuthEnabled
          && status.siteAuthenticated
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
