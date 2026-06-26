const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

const { sanitizeStoredClubName } = require('./branding');

const APP_CONFIG_KEY = 'app_config';
const LEGACY_SITE_PASSWORD_KEY = 'access_password_hash';

const DEFAULT_APP_CONFIG = {
  clubName: '',
  authMode: 'shared_password',
  siteLoginEnabled: false,
  sitePasswordHash: null,
  adminPasswordHash: null
};

function sanitizeClubName(name) {
  return sanitizeStoredClubName(name, '');
}

function normalizeAppConfig(raw = {}) {
  const authMode = raw.authMode === 'user_accounts' ? 'user_accounts' : 'shared_password';

  return {
    clubName: raw.clubName !== undefined && raw.clubName !== null
      ? sanitizeClubName(raw.clubName)
      : DEFAULT_APP_CONFIG.clubName,
    authMode,
    siteLoginEnabled: Boolean(raw.siteLoginEnabled),
    sitePasswordHash: raw.sitePasswordHash || null,
    adminPasswordHash: raw.adminPasswordHash || null
  };
}

function toPublicConfig(config) {
  return {
    clubName: config.clubName,
    authMode: config.authMode,
    siteLoginEnabled: config.siteLoginEnabled,
    siteLoginRequired: config.authMode !== 'user_accounts'
      && config.siteLoginEnabled
      && Boolean(config.sitePasswordHash),
    sitePasswordSet: Boolean(config.sitePasswordHash),
    adminLoginRequired: config.authMode !== 'user_accounts' && Boolean(config.adminPasswordHash),
    adminPasswordSet: Boolean(config.adminPasswordHash)
  };
}

async function getAppConfig() {
  const config = await prisma.siteConfig.findUnique({
    where: { key: APP_CONFIG_KEY }
  });

  if (!config) {
    return normalizeAppConfig();
  }

  try {
    return normalizeAppConfig(JSON.parse(config.value));
  } catch {
    return normalizeAppConfig();
  }
}

async function saveAppConfig(config) {
  const merged = normalizeAppConfig(config);

  await prisma.siteConfig.upsert({
    where: { key: APP_CONFIG_KEY },
    create: {
      key: APP_CONFIG_KEY,
      value: JSON.stringify(merged)
    },
    update: {
      value: JSON.stringify(merged)
    }
  });

  return merged;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifySitePassword(password) {
  const config = await getAppConfig();
  if (!config.sitePasswordHash) {
    return false;
  }
  return bcrypt.compare(password, config.sitePasswordHash);
}

async function verifyAdminPassword(password) {
  const config = await getAppConfig();
  if (!config.adminPasswordHash) {
    return false;
  }
  return bcrypt.compare(password, config.adminPasswordHash);
}

async function isSiteLoginRequired() {
  const config = await getAppConfig();
  if (config.authMode === 'user_accounts') {
    const prisma = require('./prisma');
    const count = await prisma.appUser.count();
    return count > 0;
  }
  return config.siteLoginEnabled && Boolean(config.sitePasswordHash);
}

async function isAdminLoginRequired() {
  const config = await getAppConfig();
  if (config.authMode === 'user_accounts') {
    return false;
  }
  return Boolean(config.adminPasswordHash);
}

async function migrateLegacyPassword() {
  const legacy = await prisma.siteConfig.findUnique({
    where: { key: LEGACY_SITE_PASSWORD_KEY }
  });

  if (!legacy) {
    return;
  }

  const config = await getAppConfig();
  if (!config.sitePasswordHash) {
    config.sitePasswordHash = legacy.value;
    config.siteLoginEnabled = true;
    await saveAppConfig(config);
    console.log('Migrated legacy site password to app_config.');
  }

  await prisma.siteConfig.delete({
    where: { key: LEGACY_SITE_PASSWORD_KEY }
  });
}

async function ensureAppConfigConfigured() {
  const existing = await prisma.siteConfig.findUnique({
    where: { key: APP_CONFIG_KEY }
  });

  if (!existing) {
    await saveAppConfig(DEFAULT_APP_CONFIG);
  }

  await migrateLegacyPassword();
}

async function updateAppConfig(updates = {}) {
  const current = await getAppConfig();
  const next = { ...current };

  if (updates.authMode !== undefined) {
    next.authMode = updates.authMode === 'user_accounts' ? 'user_accounts' : 'shared_password';
  }

  if (updates.clubName !== undefined) {
    next.clubName = sanitizeClubName(updates.clubName);
  }

  if (updates.siteLoginEnabled !== undefined) {
    next.siteLoginEnabled = Boolean(updates.siteLoginEnabled);
    if (!next.siteLoginEnabled) {
      next.sitePasswordHash = null;
    }
  }

  if (updates.clearSitePassword) {
    next.sitePasswordHash = null;
    next.siteLoginEnabled = false;
  } else if (updates.newSitePassword) {
    next.sitePasswordHash = await hashPassword(updates.newSitePassword);
    next.siteLoginEnabled = true;
  }

  if (updates.clearAdminPassword) {
    next.adminPasswordHash = null;
  } else if (updates.newAdminPassword) {
    next.adminPasswordHash = await hashPassword(updates.newAdminPassword);
  }

  return saveAppConfig(next);
}

module.exports = {
  APP_CONFIG_KEY,
  DEFAULT_APP_CONFIG,
  getAppConfig,
  saveAppConfig,
  updateAppConfig,
  ensureAppConfigConfigured,
  toPublicConfig,
  verifySitePassword,
  verifyAdminPassword,
  isSiteLoginRequired,
  isAdminLoginRequired,
  hashPassword
};
