const APP_NAME = 'CQ Rush';
const BRANDING_SUFFIX = 'ARRL Field Day Logbook';
const LEGACY_SUFFIX = 'ARRL Field Day Logger';

const STRIP_SUFFIXES = [
  ` ${BRANDING_SUFFIX}`,
  ` ${LEGACY_SUFFIX}`,
  ` - ${BRANDING_SUFFIX}`,
  ` - ${LEGACY_SUFFIX}`,
  ` · ${APP_NAME}`,
  ` - ${APP_NAME}`
];

function normalizeClubName(name) {
  return String(name || '').trim();
}

function stripBrandingSuffix(name) {
  let trimmed = normalizeClubName(name);
  if (!trimmed) {
    return '';
  }

  if (trimmed === APP_NAME) {
    return '';
  }

  for (const suffix of STRIP_SUFFIXES) {
    if (trimmed.endsWith(suffix)) {
      trimmed = trimmed.slice(0, -suffix.length).trim();
      break;
    }
  }

  return trimmed;
}

function sanitizeStoredClubName(name, fallback = '') {
  const base = stripBrandingSuffix(name);
  const trimmed = base.slice(0, 60);
  return trimmed || fallback;
}

module.exports = {
  APP_NAME,
  BRANDING_SUFFIX,
  sanitizeStoredClubName,
  stripBrandingSuffix
};
