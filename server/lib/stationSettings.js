const {
  DEFAULT_STATION_SETTINGS,
  normalizeSettings
} = require('./stationSettingsDefaults');
const {
  getActiveContestSettings,
  saveActiveContestSettings,
  ensureContestsConfigured
} = require('./contests');

const STATION_SETTINGS_KEY = 'station_settings';

async function getStationSettings() {
  return getActiveContestSettings();
}

async function saveStationSettings(settings) {
  return saveActiveContestSettings(settings);
}

async function ensureStationSettingsConfigured() {
  await ensureContestsConfigured();
}

module.exports = {
  STATION_SETTINGS_KEY,
  DEFAULT_STATION_SETTINGS,
  getStationSettings,
  saveStationSettings,
  ensureStationSettingsConfigured,
  normalizeSettings
};
