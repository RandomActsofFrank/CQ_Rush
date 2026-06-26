const prisma = require('./prisma');

const STATION_SETTINGS_KEY = 'station_settings';

const DEFAULT_STATION_SETTINGS = {
  callsign: '',
  entryClass: '',
  section: '',
  transmitterCount: 1,
  powerMultiplier: 2,
  bonuses: {
    emergencyPower: false,
    mediaPublicity: false,
    publicLocation: false,
    publicInfoTable: false,
    sectionManagerMessage: false,
    messageCount: 0,
    satelliteQso: false,
    alternatePower: false,
    w1awBulletin: false,
    educationalActivity: false,
    electedOfficialVisit: false,
    agencyVisit: false,
    gotaCoach: false,
    webSubmission: false,
    youthCount: 0,
    socialMedia: false,
    safetyOfficer: false,
    siteResponsibilities: false
  }
};

function normalizeSettings(settings = {}) {
  const merged = {
    ...DEFAULT_STATION_SETTINGS,
    ...settings,
    bonuses: {
      ...DEFAULT_STATION_SETTINGS.bonuses,
      ...(settings.bonuses || {})
    }
  };

  // Migrate legacy combined operatingClass (e.g. "3A") into separate fields
  if (settings.operatingClass && !merged.entryClass) {
    const legacy = String(settings.operatingClass).toUpperCase();
    const match = legacy.match(/^([1-9]|1[0-9]|20)?([A-F])$/);
    if (match) {
      if (match[1]) {
        merged.transmitterCount = parseInt(match[1], 10);
      }
      merged.entryClass = match[2];
    }
  }

  if (merged.entryClass) {
    merged.entryClass = String(merged.entryClass).toUpperCase();
  }

  if (merged.section) {
    merged.section = String(merged.section).toUpperCase();
  }

  if (merged.callsign) {
    merged.callsign = String(merged.callsign).toUpperCase().trim();
  }

  merged.transmitterCount = Math.min(
    Math.max(Number(merged.transmitterCount) || 1, 1),
    20
  );

  merged.powerMultiplier = Number(merged.powerMultiplier) || 1;

  delete merged.operatingClass;

  return merged;
}

async function getStationSettings() {
  const config = await prisma.siteConfig.findUnique({
    where: { key: STATION_SETTINGS_KEY }
  });

  if (!config) {
    return normalizeSettings();
  }

  try {
    return normalizeSettings(JSON.parse(config.value));
  } catch {
    return normalizeSettings();
  }
}

async function saveStationSettings(settings) {
  const merged = normalizeSettings(settings);

  await prisma.siteConfig.upsert({
    where: { key: STATION_SETTINGS_KEY },
    create: {
      key: STATION_SETTINGS_KEY,
      value: JSON.stringify(merged)
    },
    update: {
      value: JSON.stringify(merged)
    }
  });

  return merged;
}

async function ensureStationSettingsConfigured() {
  const existing = await prisma.siteConfig.findUnique({
    where: { key: STATION_SETTINGS_KEY }
  });

  if (!existing) {
    await saveStationSettings(DEFAULT_STATION_SETTINGS);
  }
}

module.exports = {
  STATION_SETTINGS_KEY,
  DEFAULT_STATION_SETTINGS,
  getStationSettings,
  saveStationSettings,
  ensureStationSettingsConfigured,
  normalizeSettings
};
