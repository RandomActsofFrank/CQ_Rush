export const APP_NAME = 'CQ Rush';
export const BRANDING_SUFFIX = 'ARRL Field Day Logbook';
export const COPYRIGHT_HOLDER = 'Frank Kostyun';
export const COPYRIGHT_YEAR = '2026';
export const COPYRIGHT_LINE = `${APP_NAME} © ${COPYRIGHT_HOLDER} ${COPYRIGHT_YEAR}`;
export const DONATION_URL = 'https://www.paypal.com/donate/?hosted_button_id=8FMQ97AZPEPJG';
export const APP_VERSION = '1.2.0';
export const GITHUB_URL = 'https://github.com/RandomActsofFrank/CQ_Rush';

export const BRAND_ASSETS = {
  icon: '/branding/cq_rush_white_icon.png',
  logo: '/branding/cq-rush-logo.png',
  logoWhite: '/branding/cq-rush-logo_white.png',
  banner: '/branding/cq-rush-banner.png',
  donateQr: '/branding/cq-rush-donate-qr.png'
};

const LEGACY_SUFFIX = 'ARRL Field Day Logger';

const STRIP_SUFFIXES = [
  ` ${BRANDING_SUFFIX}`,
  ` ${LEGACY_SUFFIX}`,
  ` - ${BRANDING_SUFFIX}`,
  ` - ${LEGACY_SUFFIX}`,
  ` · ${APP_NAME}`,
  ` - ${APP_NAME}`
];

export function normalizeClubName(name) {
  return String(name || '').trim();
}

export function stripBrandingSuffix(name) {
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

export function getEntryClubName(name) {
  return stripBrandingSuffix(name) || normalizeClubName(name);
}

/** Visible page header / login title: club name only, or app name if unset. */
export function formatHeaderTitle(name) {
  const base = getEntryClubName(name);
  return base || APP_NAME;
}

export function formatBrandingTitle(name) {
  return formatHeaderTitle(name);
}

export function sanitizeStoredClubName(name, fallback = '') {
  const base = getEntryClubName(name);
  const trimmed = base.slice(0, 60);
  return trimmed || fallback;
}
