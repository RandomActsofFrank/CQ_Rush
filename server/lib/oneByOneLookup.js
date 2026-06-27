const ONE_BY_ONE_SEARCH_URL = process.env.ONE_BY_ONE_SEARCH_URL
  || 'https://www.1x1callsigns.org/1x1search.php';

const ONE_BY_ONE_CALLSIGN_PATTERN = /^[KNW][0-9][A-WYZ]$/;
const ONE_BY_ONE_CACHE_META_KEY = 'one_by_one_cache_meta';

const PREFIXES = ['K', 'N', 'W'];
const DIGITS = '0123456789';
const SUFFIXES = 'ABCDEFGHIJKLMNOPQRSTUVWYZ';

function isOneByOneCallsign(callsign) {
  return ONE_BY_ONE_CALLSIGN_PATTERN.test(String(callsign || '').toUpperCase());
}

function listAllOneByOneCallsigns() {
  const callsigns = [];

  for (const prefix of PREFIXES) {
    for (const digit of DIGITS) {
      for (const suffix of SUFFIXES) {
        callsigns.push(`${prefix}${digit}${suffix}`);
      }
    }
  }

  return callsigns;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readTableField(html, label) {
  const patterns = [
    new RegExp(`<td[^>]*>\\s*${label}\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`, 'i'),
    new RegExp(`\\|\\s*${label}\\s*\\|\\s*([^|\\n]+)`, 'i')
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return stripHtml(match[1]);
    }
  }

  return '';
}

function parseOneByOneDetailPage(html, reservationId) {
  if (!html) {
    return null;
  }

  const callsign = readTableField(html, '1x1call') || readTableField(html, '1x1 call');
  const coordinator = readTableField(html, 'Coordinator');
  const eventName = readTableField(html, 'Event');
  const requestor = readTableField(html, 'Requestor');
  const requestorCall = readTableField(html, 'Requestor call') || readTableField(html, 'Requestor Call');
  const requestorAddr = readTableField(html, 'Requestor addr') || readTableField(html, 'Requestor Addr');
  const startDate = readTableField(html, 'Start');
  const endDate = readTableField(html, 'End');

  if (!callsign && !eventName && !requestorCall) {
    return null;
  }

  const parsedId = reservationId ? Number(reservationId) : NaN;

  return {
    id: Number.isFinite(parsedId) ? parsedId : null,
    callsign: callsign.toUpperCase(),
    coordinator,
    eventName,
    requestor,
    requestorCall: requestorCall.toUpperCase(),
    requestorAddr,
    startDate,
    endDate
  };
}

function extractDetailIds(html) {
  const ids = new Set();
  const pattern = /byid=(\d+)/gi;
  let match = pattern.exec(html);

  while (match) {
    ids.add(match[1]);
    match = pattern.exec(html);
  }

  return [...ids];
}

function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateOnly(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : value;
  }

  return value.toISOString().slice(0, 10);
}

function pickBestReservation(reservations, referenceDate = new Date()) {
  if (!reservations.length) {
    return null;
  }

  const refMs = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  );

  const scored = reservations
    .filter(Boolean)
    .map((reservation) => {
      const startMs = parseIsoDate(reservation.startDate);
      const endMs = parseIsoDate(reservation.endDate);

      if (startMs !== null && endMs !== null && refMs >= startMs && refMs <= endMs) {
        return { reservation, score: 0 };
      }

      if (startMs !== null && startMs > refMs) {
        return { reservation, score: 1000 + (startMs - refMs) / 86400000 };
      }

      if (endMs !== null) {
        return { reservation, score: 2000 + (refMs - endMs) / 86400000 };
      }

      return { reservation, score: 3000 };
    })
    .sort((a, b) => a.score - b.score);

  return scored[0]?.reservation || reservations[0];
}

function reservationToLookupResult(reservation, source = '1x1') {
  const licenseName = reservation.licenseName || '';
  const requestorCall = reservation.requestorCall || reservation.holderCallsign || '';

  return {
    success: true,
    callsign: reservation.callsign,
    name: licenseName || reservation.name || '',
    eventName: reservation.eventName || '',
    coordinator: reservation.coordinator || '',
    requestor: reservation.requestor || reservation.holderName || '',
    holderCallsign: requestorCall,
    holderName: licenseName || reservation.requestor || reservation.holderName || '',
    requestorAddr: reservation.requestorAddr || '',
    startDate: formatDateOnly(reservation.startDate),
    endDate: formatDateOnly(reservation.endDate),
    grid: reservation.grid || '',
    city: reservation.city || '',
    state: reservation.state || '',
    country: reservation.country || '',
    specialEvent: true,
    source
  };
}

async function fetchOneByOneHtml(url, fetchImpl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let response;
  try {
    response = await fetchImpl(url, {
      headers: {
        'User-Agent': 'CQ-Rush/1.2.0 (Field Day logger; +https://github.com/RandomActsofFrank/CQ_Rush)',
        Accept: 'text/html'
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`1x1 lookup HTTP ${response.status}`);
  }

  return response.text();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDateInput(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function isValidDateRange(startDate, endDate) {
  return Boolean(startDate && endDate && startDate <= endDate);
}

function buildOneByOneDateRangeSearchUrl(startDate, endDate) {
  const start = normalizeDateInput(startDate);
  const end = normalizeDateInput(endDate);
  return `${ONE_BY_ONE_SEARCH_URL}?startd=${encodeURIComponent(start)}&endd=${encodeURIComponent(end)}`;
}

function addUtcDays(date, days) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function getFieldDayWeekend(year) {
  const fullWeekendSaturdays = [];

  for (let day = 1; day <= 30; day += 1) {
    const saturday = new Date(Date.UTC(year, 5, day));
    if (saturday.getUTCMonth() !== 5) {
      break;
    }

    if (saturday.getUTCDay() === 6) {
      const sunday = addUtcDays(saturday, 1);
      if (sunday.getUTCMonth() === 5) {
        fullWeekendSaturdays.push(saturday);
      }
    }
  }

  if (fullWeekendSaturdays.length < 4) {
    throw new Error(`Could not determine Field Day weekend for ${year}`);
  }

  const saturday = fullWeekendSaturdays[3];
  return {
    saturday,
    sunday: addUtcDays(saturday, 1)
  };
}

function suggestedFieldDayDateRange(referenceDate = new Date()) {
  let year = referenceDate.getUTCFullYear();
  let { saturday, sunday } = getFieldDayWeekend(year);
  const cacheEnd = addUtcDays(sunday, 2);

  if (referenceDate > cacheEnd) {
    year += 1;
    ({ saturday, sunday } = getFieldDayWeekend(year));
  }

  return {
    startDate: addUtcDays(saturday, -2).toISOString().slice(0, 10),
    endDate: addUtcDays(sunday, 2).toISOString().slice(0, 10),
    fieldDayStart: saturday.toISOString().slice(0, 10),
    fieldDayEnd: sunday.toISOString().slice(0, 10)
  };
}

function parseOneByOneSearchResultsPage(html) {
  if (!html) {
    return [];
  }

  const rows = [];
  const rowPattern = /<tr><td>([KNW][0-9][A-WYZ])<\/td><td>(\d{4}-\d{2}-\d{2})<\/td><td>(\d{4}-\d{2}-\d{2})<\/td><td>([\s\S]*?)<\/td><td><a href=[^>]*byid=(\d+)[^>]*>/gi;
  let match = rowPattern.exec(html);

  while (match) {
    rows.push({
      callsign: match[1].toUpperCase(),
      startDate: match[2],
      endDate: match[3],
      eventName: stripHtml(match[4].replace(/&#039;/g, "'").replace(/&amp;/g, '&')),
      id: Number(match[5])
    });
    match = rowPattern.exec(html);
  }

  return rows;
}

async function lookupOneByOneCallsign(callsign, fetchImpl) {
  const normalized = String(callsign || '').toUpperCase();

  if (!isOneByOneCallsign(normalized)) {
    return { success: false, message: 'Not a 1x1 special event callsign' };
  }

  const searchUrl = `${ONE_BY_ONE_SEARCH_URL}?callsign=${encodeURIComponent(normalized)}`;
  const searchHtml = await fetchOneByOneHtml(searchUrl, fetchImpl);
  const detailIds = extractDetailIds(searchHtml).slice(0, 10);

  let reservations = [];

  if (detailIds.length > 0) {
    const detailPages = await Promise.all(
      detailIds.map((id) => fetchOneByOneHtml(`${ONE_BY_ONE_SEARCH_URL}?byid=${id}`, fetchImpl))
    );
    reservations = detailPages
      .map((html, index) => parseOneByOneDetailPage(html, detailIds[index]))
      .filter((entry) => entry && entry.callsign === normalized);
  } else {
    const directDetail = parseOneByOneDetailPage(searchHtml);
    if (directDetail && directDetail.callsign === normalized) {
      reservations = [directDetail];
    }
  }

  const best = pickBestReservation(reservations);
  if (!best) {
    return { success: false, message: '1x1 callsign not found in special event database' };
  }

  return reservationToLookupResult(best, '1x1');
}

module.exports = {
  ONE_BY_ONE_SEARCH_URL,
  ONE_BY_ONE_CACHE_META_KEY,
  isOneByOneCallsign,
  listAllOneByOneCallsigns,
  parseOneByOneDetailPage,
  parseOneByOneSearchResultsPage,
  extractDetailIds,
  pickBestReservation,
  reservationToLookupResult,
  formatDateOnly,
  normalizeDateInput,
  isValidDateRange,
  buildOneByOneDateRangeSearchUrl,
  suggestedFieldDayDateRange,
  getFieldDayWeekend,
  fetchOneByOneHtml,
  delay,
  lookupOneByOneCallsign
};
