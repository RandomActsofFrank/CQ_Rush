// ARRL Field Day operating classes: transmitter count (1-20) + category A-F
// https://www.arrl.org/field-day-rules
export const ARRL_CLASS_PATTERN = /^([1-9]|1[0-9]|20)[A-F]$/;

export const ARRL_CLASS_TOOLTIP = `ARRL Field Day Class Format: number of transmitters (1-20) + category letter (A-F)

A - Club / group portable (3+ persons)
B - One or two person portable
C - Mobile
D - Home station (commercial power)
E - Home station (emergency power)
F - Emergency Operations Center (EOC)

Exchange example: 3A CT (3 transmitters, Class A, Connecticut section)`;

export const ARRL_CLASS_PLACEHOLDER = 'e.g., 1A, 3A, 2B';

export const ARRL_CLASS_ERROR =
  'Invalid class! Enter transmitter count (1-20) + category A-F (e.g., 1A, 3A, 2B).';

export const ARRL_VALID_SECTIONS = [
  'DX', 'MX',
  'CT', 'EMA', 'ME', 'NH', 'RI', 'VT', 'WMA',
  'ENY', 'NLI', 'NNJ', 'NNY', 'SNJ', 'WNY',
  'DE', 'EPA', 'MDC', 'WPA',
  'AL', 'GA', 'KY', 'NC', 'NFL', 'PR', 'SC', 'SFL', 'TN', 'VA', 'VI', 'WCF',
  'AR', 'LA', 'MS', 'NM', 'NTX', 'OK', 'STX', 'WTX',
  'EB', 'LAX', 'ORG', 'PAC', 'SB', 'SCV', 'SDG', 'SF', 'SJV', 'SV',
  'AK', 'AZ', 'EWA', 'ID', 'MT', 'NV', 'OR', 'UT', 'WWA', 'WY',
  'MI', 'OH', 'WV',
  'IL', 'IN', 'WI',
  'CO', 'IA', 'KS', 'MN', 'MO', 'ND', 'NE', 'SD',
  'AB', 'BC', 'GH', 'MB', 'NB', 'NL', 'NS', 'ONE', 'ONN', 'ONS', 'PE', 'QC', 'SK', 'TER'
];

export function validateClass(classEntry) {
  if (!classEntry) return false;
  return ARRL_CLASS_PATTERN.test(classEntry.toUpperCase());
}

export function validateLocation(location) {
  if (!location) return false;
  return ARRL_VALID_SECTIONS.includes(location.toUpperCase());
}

// ARRL Field Day QSO points (before power multiplier and bonus points)
export function calculateQsoPoints(contacts) {
  let totalPoints = 0;
  const contactTracker = new Map();

  contacts.forEach((contact) => {
    const key = `${contact.callsign}-${contact.frequency}-${contact.mode}`;
    if (contactTracker.has(key)) {
      return;
    }
    contactTracker.set(key, true);

    if (contact.mode === 'Phone') {
      totalPoints += 1;
    } else if (contact.mode === 'CW' || contact.mode === 'Digital') {
      totalPoints += 2;
    }
  });

  return totalPoints;
}

export function calculateScoreBreakdown(contacts) {
  const breakdown = {
    phone: 0,
    cw: 0,
    digital: 0,
    total: 0
  };

  const contactTracker = new Map();

  contacts.forEach((contact) => {
    const key = `${contact.callsign}-${contact.frequency}-${contact.mode}`;
    if (contactTracker.has(key)) {
      return;
    }
    contactTracker.set(key, true);

    if (contact.mode === 'Phone') {
      breakdown.phone++;
      breakdown.total += 1;
    } else if (contact.mode === 'CW') {
      breakdown.cw++;
      breakdown.total += 2;
    } else if (contact.mode === 'Digital') {
      breakdown.digital++;
      breakdown.total += 2;
    }
  });

  return breakdown;
}

export const POWER_MULTIPLIER_OPTIONS = [
  { value: 5, label: '×5 — QRP (≤5W, battery/solar/non-commercial)' },
  { value: 2, label: '×2 — ≤100W (or QRP on generator/mains)' },
  { value: 1, label: '×1 — Any contact >100W' }
];

export const BONUS_GROUPS = [
  {
    title: 'Power & Site',
    items: [
      { key: 'emergencyPower', label: '100% Emergency Power', points: '100 × transmitters', type: 'checkbox' },
      { key: 'publicLocation', label: 'Public Location', points: 100, type: 'checkbox' },
      { key: 'publicInfoTable', label: 'Public Information Table', points: 100, type: 'checkbox' },
      { key: 'alternatePower', label: 'Alternate Power (5+ QSOs)', points: 100, type: 'checkbox' }
    ]
  },
  {
    title: 'Media & Submission',
    items: [
      { key: 'mediaPublicity', label: 'Media Publicity', points: 100, type: 'checkbox' },
      { key: 'socialMedia', label: 'Social Media Promotion', points: 100, type: 'checkbox' },
      { key: 'webSubmission', label: 'Web Submission', points: 50, type: 'checkbox' }
    ]
  },
  {
    title: 'Messages & Bulletin',
    items: [
      { key: 'sectionManagerMessage', label: 'Message to Section Manager', points: 100, type: 'checkbox' },
      { key: 'messageCount', label: 'Formal Messages Handled', points: '10 each (max 10)', type: 'number', min: 0, max: 10 },
      { key: 'w1awBulletin', label: 'W1AW Field Day Bulletin Copied', points: 100, type: 'checkbox' }
    ]
  },
  {
    title: 'Operations',
    items: [
      { key: 'satelliteQso', label: 'Satellite QSO', points: 100, type: 'checkbox' },
      { key: 'educationalActivity', label: 'Educational Activity', points: 100, type: 'checkbox' },
      { key: 'gotaCoach', label: 'GOTA Coach (10+ supervised contacts)', points: 100, type: 'checkbox' }
    ]
  },
  {
    title: 'Visitors',
    items: [
      { key: 'electedOfficialVisit', label: 'Elected Official Visit', points: 100, type: 'checkbox' },
      { key: 'agencyVisit', label: 'Served Agency Representative Visit', points: 100, type: 'checkbox' }
    ]
  },
  {
    title: 'Youth & Safety',
    items: [
      { key: 'youthCount', label: 'Youth Participants (age ≤18 w/ QSO)', points: '20 each (max 5)', type: 'number', min: 0, max: 5 },
      { key: 'safetyOfficer', label: 'Safety Officer (Class A)', points: 100, type: 'checkbox' },
      { key: 'siteResponsibilities', label: 'Site Responsibilities Checklist', points: 50, type: 'checkbox' }
    ]
  }
];

export const ENTRY_CLASS_OPTIONS = [
  { value: 'A', label: 'A — Club / group portable (3+ persons)' },
  { value: 'B', label: 'B — One or two person portable' },
  { value: 'C', label: 'C — Mobile' },
  { value: 'D', label: 'D — Home station (commercial power)' },
  { value: 'E', label: 'E — Home station (emergency power)' },
  { value: 'F', label: 'F — Emergency Operations Center (EOC)' }
];

export const DEFAULT_STATION_SETTINGS = {
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

export function validateEntryClass(entryClass) {
  if (!entryClass) return false;
  return /^[A-F]$/.test(entryClass.toUpperCase());
}

export function normalizeStationSettings(settings = {}) {
  const merged = {
    ...DEFAULT_STATION_SETTINGS,
    ...settings,
    bonuses: {
      ...DEFAULT_STATION_SETTINGS.bonuses,
      ...(settings.bonuses || {})
    }
  };

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

export function formatExchange(settings) {
  if (!settings?.entryClass || !settings?.section) {
    return null;
  }

  const transmitters = Math.min(Math.max(Number(settings.transmitterCount) || 1, 1), 20);
  return `${transmitters}${settings.entryClass.toUpperCase()} ${settings.section.toUpperCase()}`;
}

export function calculateBonusPoints(settings) {
  const bonuses = settings?.bonuses || DEFAULT_STATION_SETTINGS.bonuses;
  let total = 0;
  const breakdown = [];

  const addBonus = (label, points) => {
    if (points > 0) {
      total += points;
      breakdown.push({ label, points });
    }
  };

  if (bonuses.emergencyPower) {
    const transmitters = Math.min(Math.max(settings.transmitterCount || 1, 1), 20);
    addBonus('Emergency Power', transmitters * 100);
  }

  const checkboxBonuses = [
    ['mediaPublicity', 'Media Publicity', 100],
    ['publicLocation', 'Public Location', 100],
    ['publicInfoTable', 'Public Info Table', 100],
    ['sectionManagerMessage', 'Section Manager Message', 100],
    ['satelliteQso', 'Satellite QSO', 100],
    ['alternatePower', 'Alternate Power', 100],
    ['w1awBulletin', 'W1AW Bulletin', 100],
    ['educationalActivity', 'Educational Activity', 100],
    ['electedOfficialVisit', 'Official Visit', 100],
    ['agencyVisit', 'Agency Visit', 100],
    ['gotaCoach', 'GOTA Coach', 100],
    ['webSubmission', 'Web Submission', 50],
    ['socialMedia', 'Social Media', 100],
    ['safetyOfficer', 'Safety Officer', 100],
    ['siteResponsibilities', 'Site Responsibilities', 50]
  ];

  checkboxBonuses.forEach(([key, label, points]) => {
    if (bonuses[key]) {
      addBonus(label, points);
    }
  });

  const messageCount = Math.min(Math.max(Number(bonuses.messageCount) || 0, 0), 10);
  addBonus('Messages Handled', messageCount * 10);

  const youthCount = Math.min(Math.max(Number(bonuses.youthCount) || 0, 0), 5);
  addBonus('Youth Participation', youthCount * 20);

  return { total, breakdown };
}

export function calculateProjectedScore(qsoPoints, settings) {
  const multiplier = settings?.powerMultiplier || 1;
  const multiplied = qsoPoints * multiplier;
  const { total: bonusTotal, breakdown: bonusBreakdown } = calculateBonusPoints(settings);

  return {
    qsoPoints,
    powerMultiplier: multiplier,
    multipliedScore: multiplied,
    bonusPoints: bonusTotal,
    bonusBreakdown,
    finalScore: multiplied + bonusTotal,
    exchange: formatExchange(settings)
  };
}
