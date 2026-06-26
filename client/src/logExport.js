import {
  getActiveContacts,
  validateCabrilloExport,
  formatSentClass
} from './cabrilloExport';
import { normalizeStationSettings } from './fieldDayRules';
import { APP_NAME } from './branding';

export const LOTW_LOGIN_URL = 'https://lotw.arrl.org/lotw/login';
export const LOTW_UPLOAD_URL = 'https://lotw.arrl.org/lotw/upload';
export const QRZ_LOGBOOK_URL = 'https://logbook.qrz.com/logbook';

const BAND_TO_ADIF = {
  160: '160M',
  80: '80M',
  40: '40M',
  20: '20M',
  15: '15M',
  10: '10M',
  6: '6M',
  '6 (50 MHz)': '6M',
  2: '2M',
  '2 (144 MHz)': '2M',
  1.25: '222MHz',
  '1.25 (222 MHz)': '222MHz',
  '70cm': '432MHz',
  '70 cm (432 MHz)': '432MHz',
  '33cm': '902MHz',
  '33 cm (902 MHz)': '902MHz',
  '23cm': '1.2GHz',
  '23 cm (1.3 GHz)': '1.2GHz',
  '13cm': '2.3GHz',
  '13 cm (2.3 GHz)': '2.3GHz',
  '9cm': '3.4GHz',
  '9 cm (3.5 GHz)': '3.4GHz',
  '6cm': '5.7GHz',
  '6 cm (5.8 GHz)': '5.7GHz',
  '3cm': '10GHz',
  '3 cm (10 GHz)': '10GHz',
  satellite: 'SAT',
  other: 'OTHER'
};

function adifField(name, value) {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);
  if (!str) {
    return '';
  }

  return `<${name}:${str.length}>${str}`;
}

function adifBand(frequency) {
  if (!frequency) {
    return '20M';
  }

  const key = String(frequency).trim();
  if (BAND_TO_ADIF[key]) {
    return BAND_TO_ADIF[key];
  }

  const short = key.replace(/\s*\([^)]*\)$/, '').trim();
  return BAND_TO_ADIF[short] || key.toUpperCase();
}

function adifMode(mode) {
  if (mode === 'CW') {
    return 'CW';
  }
  if (mode === 'Digital') {
    return 'RTTY';
  }
  return 'SSB';
}

function formatQsoDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10).replace(/-/g, '');
}

function formatQsoTime(timestamp) {
  return new Date(timestamp).toISOString().slice(11, 19).replace(/:/g, '');
}

export function validateAdifExport({ settings, contacts, clubName }) {
  return validateCabrilloExport({ settings, contacts, clubName });
}

export function generateAdifLog({
  contacts,
  settings,
  clubName,
  programName = APP_NAME
}) {
  const validation = validateAdifExport({ settings, contacts, clubName });

  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join(' '));
  }

  const normalized = normalizeStationSettings(validation.settings);
  const activeContacts = getActiveContacts(contacts).sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  const stationCallsign = (normalized.callsign || '').trim().toUpperCase();
  const sentClass = formatSentClass(normalized);
  const sentSection = (normalized.section || '').toUpperCase();
  const sentExchange = [sentClass, sentSection].filter(Boolean).join(' ');

  const header = [
    `ADIF export from ${programName}`,
    adifField('PROGRAMID', programName),
    adifField('CREATED_TIMESTAMP', new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')),
    '<EOH>',
    ''
  ].filter(Boolean).join('\r\n');

  const records = activeContacts.map((contact) => {
    const receivedExchange = [
      (contact.classSent || '').toUpperCase().trim(),
      (contact.locationReceived || '').toUpperCase().trim()
    ].filter(Boolean).join(' ');

    const fields = [
      adifField('STATION_CALLSIGN', stationCallsign),
      adifField('CALL', (contact.callsign || '').toUpperCase()),
      adifField('QSO_DATE', formatQsoDate(contact.timestamp)),
      adifField('TIME_ON', formatQsoTime(contact.timestamp)),
      adifField('BAND', adifBand(contact.frequency)),
      adifField('MODE', adifMode(contact.mode)),
      adifField('RST_SENT', '59'),
      adifField('RST_RCVD', '59'),
      adifField('CONTEST_ID', 'ARRL-FD'),
      adifField('STX_STRING', sentExchange),
      adifField('SRX_STRING', receivedExchange),
      contact.name ? adifField('NAME', contact.name) : '',
      contact.operator || contact.createdBy
        ? adifField('OPERATOR', contact.operator || contact.createdBy)
        : '',
      contact.locationReceived
        ? adifField('ARRL_SECT', String(contact.locationReceived).toUpperCase())
        : '',
      contact.notes ? adifField('COMMENT', contact.notes) : ''
    ].filter(Boolean);

    return `${fields.join('\r\n')}\r\n<EOR>\r\n`;
  });

  return {
    content: `${header}${records.join('\r\n')}`,
    callsign: stationCallsign,
    validation,
    contactCount: activeContacts.length
  };
}

export function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadAdifFile(content, callsign) {
  const safeCall = (callsign || 'export').replace(/[^A-Za-z0-9]/g, '');
  downloadTextFile(content, `${safeCall}.adi`);
}
