import {
  calculateProjectedScore,
  calculateQsoPoints,
  calculateScoreBreakdown,
  calculateBonusPoints,
  formatExchange,
  normalizeStationSettings,
  POWER_MULTIPLIER_OPTIONS
} from './fieldDayRules';
import { getEntryClubName } from './branding';

export const ARRL_FD_ENTRY_URL = 'https://field-day.arrl.org/fdentry.php';

const BAND_TO_CABRILLO_FREQ = {
  160: '1800',
  80: '3500',
  40: '7000',
  20: '14000',
  15: '21000',
  10: '28000',
  '6 (50 MHz)': '50',
  6: '50',
  '2 (144 MHz)': '144',
  2: '144',
  '1.25 (222 MHz)': '222',
  1.25: '222',
  '70 cm (432 MHz)': '432',
  '70cm': '432',
  '33 cm (902 MHz)': '902',
  '33cm': '902',
  '23 cm (1.3 GHz)': '1.2G',
  '23cm': '1.2G',
  '13 cm (2.3 GHz)': '2.3G',
  '13cm': '2.3G',
  '9 cm (3.5 GHz)': '3.4G',
  '9cm': '3.4G',
  '6 cm (5.8 GHz)': '5.7G',
  '6cm': '5.7G',
  '3 cm (10 GHz)': '10G',
  '3cm': '10G',
  satellite: 'SAT',
  other: 'OTHER'
};

function cabrilloMode(mode) {
  if (mode === 'Phone') return 'PH';
  if (mode === 'CW') return 'CW';
  if (mode === 'Digital') return 'DG';
  return 'PH';
}

function cabrilloFrequency(band) {
  if (!band) return '14000';

  const key = String(band).trim();
  if (BAND_TO_CABRILLO_FREQ[key]) {
    return BAND_TO_CABRILLO_FREQ[key];
  }

  const short = key.replace(/\s*\([^)]*\)$/, '').trim();
  return BAND_TO_CABRILLO_FREQ[short] || key;
}

export function formatSentClass(settings) {
  if (!settings?.entryClass) {
    return '';
  }

  const transmitters = Math.min(Math.max(Number(settings.transmitterCount) || 1, 1), 20);
  return `${transmitters}${settings.entryClass.toUpperCase()}`;
}

function categoryStation(entryClass) {
  const category = (entryClass || '').toUpperCase();
  if (category === 'C') return 'MOBILE';
  if (category === 'D' || category === 'E' || category === 'F') return 'FIXED';
  return 'PORTABLE';
}

function categoryPower(powerMultiplier) {
  if (powerMultiplier === 5) return 'QRP';
  if (powerMultiplier === 2) return 'LOW';
  return 'HIGH';
}

function categoryOperator(transmitterCount) {
  return (Number(transmitterCount) || 1) <= 1 ? 'SINGLE-OP' : 'MULTI-OP';
}

export function getContactOperator(contact) {
  return contact?.operator || contact?.createdBy || null;
}

export function getActiveContacts(contacts) {
  return (contacts || []).filter((contact) => contact.deleted !== 'Y');
}

export function buildQsoTotalsByBandMode(contacts) {
  const totals = {};

  getActiveContacts(contacts).forEach((contact) => {
    const key = `${contact.frequency || 'Unknown'} / ${contact.mode || 'Unknown'}`;
    totals[key] = (totals[key] || 0) + 1;
  });

  return totals;
}

export function collectOperators(contacts) {
  const operators = new Set();

  getActiveContacts(contacts).forEach((contact) => {
    const operator = getContactOperator(contact);
    if (operator) {
      operators.add(operator);
    }
  });

  return [...operators].sort();
}

export function validateCabrilloExport({ settings, contacts, clubName }) {
  const normalized = normalizeStationSettings(settings);
  const errors = [];
  const warnings = [];
  const activeContacts = getActiveContacts(contacts);

  if (!(normalized.callsign || '').trim()) {
    errors.push('Entry callsign is required (Station Settings → Entry Callsign).');
  }

  if (!normalized.entryClass) {
    errors.push('Entry class (A–F) is required in Station Settings.');
  }

  if (!normalized.section) {
    errors.push('ARRL/RAC section is required in Station Settings.');
  }

  if (activeContacts.length === 0) {
    errors.push('No active contacts to export.');
  }

  activeContacts.forEach((contact, index) => {
    if (!contact.callsign) {
      warnings.push(`Contact #${index + 1} is missing a callsign.`);
    }
    if (!contact.classSent || !contact.locationReceived) {
      warnings.push(`${contact.callsign || `Contact #${index + 1}`}: missing class or section received.`);
    }
  });

  const entryClubName = getEntryClubName(clubName);

  if (!entryClubName.trim()) {
    warnings.push('Club or individual name is not set (Security & Branding).');
  }

  return {
    errors,
    warnings,
    settings: normalized,
    activeContactCount: activeContacts.length
  };
}

export function generateCabrilloLog({
  contacts,
  settings,
  clubName,
  softwareVersion = 'CQ Rush'
}) {
  const entryClubName = getEntryClubName(clubName);
  const validation = validateCabrilloExport({ settings, contacts, clubName: entryClubName });

  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join(' '));
  }

  const normalized = validation.settings;
  const activeContacts = getActiveContacts(contacts).sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  const sentClass = formatSentClass(normalized);
  const sentSection = (normalized.section || '').toUpperCase();
  const callsign = normalized.callsign.trim().toUpperCase();
  const qsoPoints = calculateQsoPoints(activeContacts);
  const projected = calculateProjectedScore(qsoPoints, normalized);
  const operators = collectOperators(activeContacts);

  const lines = [
    `CALLSIGN: ${callsign}`,
    'CONTEST: ARRL-FD',
    `LOCATION: ${sentSection}`,
    `CATEGORY-OPERATOR: ${categoryOperator(normalized.transmitterCount)}`,
    'CATEGORY-ASSISTED: NON-ASSISTED',
    'CATEGORY-BAND: ALL',
    'CATEGORY-MODE: MIXED',
    `CATEGORY-POWER: ${categoryPower(normalized.powerMultiplier)}`,
    `CATEGORY-STATION: ${categoryStation(normalized.entryClass)}`,
    ...(entryClubName ? [`CLUB: ${entryClubName.slice(0, 60)}`] : []),
    `CREATED-BY: ${softwareVersion}`,
    `CLAIMED-SCORE: ${projected.finalScore}`
  ];

  if (operators.length > 0) {
    lines.push(`OPERATORS: ${operators.join(' ')}`);
  }

  lines.push(`SOAPBOX: Generated by CQ Rush. Upload this file at field-day.arrl.org as dupe-sheet documentation.`);
  lines.push('START-OF-LOG:');

  activeContacts.forEach((contact) => {
    const timestamp = new Date(contact.timestamp);
    const date = timestamp.toISOString().slice(0, 10);
    const time = timestamp.toISOString().slice(11, 16).replace(':', '');
    const freq = cabrilloFrequency(contact.frequency);
    const mode = cabrilloMode(contact.mode);
    const receivedClass = (contact.classSent || '').toUpperCase().trim();
    const receivedSection = (contact.locationReceived || '').toUpperCase().trim();

    lines.push(
      `QSO: ${freq} ${mode} ${date} ${time} ${callsign} ${sentClass} ${sentSection} ${(contact.callsign || '').toUpperCase()} ${receivedClass} ${receivedSection}`
    );
  });

  lines.push('END-OF-LOG:');

  return {
    content: `${lines.join('\r\n')}\r\n`,
    validation,
    projected,
    callsign
  };
}

export function buildArrlEntrySummary({ contacts, settings, clubName }) {
  const normalized = normalizeStationSettings(settings);
  const entryClubName = getEntryClubName(clubName);
  const activeContacts = getActiveContacts(contacts);
  const qsoPoints = calculateQsoPoints(activeContacts);
  const breakdown = calculateScoreBreakdown(activeContacts);
  const projected = calculateProjectedScore(qsoPoints, normalized);
  const bonusPreview = calculateBonusPoints(normalized);
  const exchange = formatExchange(normalized);
  const powerLabel = POWER_MULTIPLIER_OPTIONS.find(
    (option) => option.value === normalized.powerMultiplier
  )?.label || `×${normalized.powerMultiplier}`;
  const qsoTotals = buildQsoTotalsByBandMode(contacts);
  const operators = collectOperators(contacts);

  const bonusLines = bonusPreview.breakdown.map(
    (item) => `${item.label}: +${item.points}`
  );

  return {
    entryUrl: ARRL_FD_ENTRY_URL,
    callUsed: (normalized.callsign || '').toUpperCase(),
    clubName: entryClubName,
    section: (normalized.section || '').toUpperCase(),
    entryClass: normalized.entryClass || '',
    transmitterCount: normalized.transmitterCount,
    operatingClass: exchange ? exchange.split(' ')[0] : formatSentClass(normalized),
    exchange,
    powerMultiplier: powerLabel,
    claimedScore: projected.finalScore,
    qsoPoints,
    multipliedScore: projected.multipliedScore,
    bonusPoints: projected.bonusPoints,
    phoneQsos: breakdown.phone,
    cwQsos: breakdown.cw,
    digitalQsos: breakdown.digital,
    totalQsos: activeContacts.length,
    qsoTotalsByBandMode: qsoTotals,
    operators,
    bonusLines,
    notes: [
      'A Cabrillo file alone is not a complete Field Day entry.',
      'Complete the summary at field-day.arrl.org and upload this Cabrillo file as your dupe sheet / contacts list.',
      'Check claimed bonus points against your Station Settings and attach any required documentation.'
    ]
  };
}

export function downloadCabrilloFile(content, callsign) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeCall = (callsign || 'fieldday').replace(/[^A-Za-z0-9]/g, '');

  anchor.href = url;
  anchor.download = `${safeCall}.log`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function formatEntrySummaryText(summary) {
  const bandModeLines = Object.entries(summary.qsoTotalsByBandMode)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bandMode, count]) => `  ${bandMode}: ${count}`);

  return [
    'ARRL Field Day Entry Summary (from CQ Rush)',
    '==========================================',
    '',
    `Call Used: ${summary.callUsed || '(not set)'}`,
    `Club / Individual or Group Name: ${summary.clubName || '(not set)'}`,
    `ARRL/RAC Section: ${summary.section || '(not set)'}`,
    `Operating Class: ${summary.operatingClass || '(not set)'}`,
    `Exchange Sent: ${summary.exchange || '(not set)'}`,
    `Transmitters: ${summary.transmitterCount}`,
    `Power Multiplier: ${summary.powerMultiplier}`,
    '',
    'Score',
    '-----',
    `QSO Points: ${summary.qsoPoints}`,
    `After Power Multiplier: ${summary.multipliedScore}`,
    `Bonus Points: ${summary.bonusPoints}`,
    `Claimed Score: ${summary.claimedScore}`,
    '',
    'QSO Totals by Band / Mode',
    '-------------------------',
    ...(bandModeLines.length ? bandModeLines : ['  (none)']),
    '',
    `Phone QSOs: ${summary.phoneQsos}`,
    `CW QSOs: ${summary.cwQsos}`,
    `Digital QSOs: ${summary.digitalQsos}`,
    `Total QSOs: ${summary.totalQsos}`,
    '',
    'Operators',
    '---------',
    ...(summary.operators.length ? summary.operators.map((op) => `  ${op}`) : ['  (none logged)']),
    '',
    'Bonus Points Claimed (from Station Settings)',
    '--------------------------------------------',
    ...(summary.bonusLines.length ? summary.bonusLines.map((line) => `  ${line}`) : ['  (none selected)']),
    '',
    'Submission',
    '----------',
    `Web entry: ${summary.entryUrl}`,
    ...summary.notes.map((note) => `• ${note}`)
  ].join('\n');
}
