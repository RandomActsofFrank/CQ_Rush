const { getLocationFromCoords } = require('./geo');

const ISED_SEARCH_URL = process.env.ISED_AMATEUR_SEARCH_URL
  || 'https://apc-cap.ic.gc.ca/pls/apc_anon/query_amat_cs$.search';
const FOXHOLLOW_LOOKUP_URLS = [
  process.env.CANADIAN_CALLSIGN_LOOKUP_URL,
  'https://hamster.foxhollow.ca/ccd/index.php',
  'https://web1.foxhollow.ca/ccd/index.php',
  'https://gizmo.foxhollow.ca/ccd/index.php'
].filter(Boolean);

// Canadian amateur prefixes (ITU): VA, VE, VO, VY, CY and CF–CK (excluding CH = Cuba).
const CANADIAN_AMATEUR_PREFIX = /^(VA|VE|VO|VY|CY|CF|CG|CI|CJ|CK)[0-9]/;

function resolveFetch() {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis);
  }

  return require('node-fetch');
}

function isCanadianCallsign(callsign) {
  return CANADIAN_AMATEUR_PREFIX.test(String(callsign || '').toUpperCase());
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCityProvincePostal(text) {
  const match = String(text || '').match(
    /([A-Za-z][A-Za-z0-9 .'-]+),\s*(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\s*([A-Z]\d[A-Z]\s?\d[A-Z]\d)?/i
  );

  if (!match) {
    return null;
  }

  return {
    city: match[1].trim().toUpperCase(),
    province: match[2].toUpperCase(),
    postalCode: match[3] ? match[3].replace(/\s+/g, '').toUpperCase() : ''
  };
}

function parseFoxhollowHtml(html, callsign) {
  const normalized = String(callsign || '').toUpperCase();
  const marker = `<font color=red><b>${normalized}</b></font>&nbsp;`;
  const start = html.indexOf(marker);

  if (start === -1) {
    return null;
  }

  const chunk = html.slice(start, start + 1500);
  const nameMatch = chunk.match(/<font color=red><b>[^<]+<\/b><\/font>&nbsp;([^<\n]+)/i);
  const cityMatch = chunk.match(
    /([A-Za-z][A-Za-z0-9 .'-]+),\s*(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\s*([A-Z]\d[A-Z]\s?\d[A-Z]\d)?/i
  );

  if (!nameMatch) {
    return null;
  }

  const name = stripHtml(nameMatch[1]);
  const location = cityMatch
    ? {
      city: cityMatch[1].trim().toUpperCase(),
      province: cityMatch[2].toUpperCase(),
      postalCode: cityMatch[3] ? cityMatch[3].replace(/\s+/g, '').toUpperCase() : ''
    }
    : null;

  const addressMatch = chunk.match(/<br>([^<]+)<br>\s*[A-Za-z][A-Za-z0-9 .'-]+,/i);
  const addressLine = addressMatch ? stripHtml(addressMatch[1]) : '';

  return {
    callsign: normalized,
    name,
    addressLine: /address withheld/i.test(addressLine) ? '' : addressLine,
    city: location?.city || '',
    province: location?.province || '',
    postalCode: location?.postalCode || '',
    isClub: /\bclub\b|\bmuseum\b|\bgroup\b|\brepeater\b|\bheritage\b|\bassociation\b/i.test(name)
  };
}

function parseIsedSearchHtml(html, callsign) {
  const normalized = String(callsign || '').toUpperCase();
  if (!html || !html.includes(normalized)) {
    return null;
  }

  const cityMatch = html.match(
    /([A-Za-z][A-Za-z0-9 .'-]+),\s*(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/i
  );

  const nameMatch = html.match(
    new RegExp(
      `${normalized}[\\s\\S]{0,400}?(?:Individual|Club)[\\s\\S]{0,120}?<td[^>]*>([^<]{2,80})</td>`,
      'i'
    )
  ) || html.match(
    new RegExp(`${normalized}[\\s\\S]{0,250}?<td[^>]*>([A-Za-z][^<,;]{2,80})</td>`, 'i')
  );

  const name = stripHtml(nameMatch?.[1] || '');
  if (!name && !cityMatch) {
    return null;
  }

  return {
    callsign: normalized,
    name: name || normalized,
    addressLine: '',
    city: cityMatch ? cityMatch[1].trim().toUpperCase() : '',
    province: cityMatch ? cityMatch[2].toUpperCase() : '',
    postalCode: '',
    isClub: /club/i.test(html.slice(Math.max(0, html.indexOf(normalized) - 80), html.indexOf(normalized) + 200))
  };
}

async function geocodeCanadianLocation(city, province, postalCode) {
  const fetchImpl = resolveFetch();
  const query = [postalCode, city, province, 'Canada'].filter(Boolean).join(', ');

  try {
    const response = await fetchImpl(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ca&q=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent': 'CQ-Rush/1.2.1 (Field Day logger; +https://github.com/RandomActsofFrank/CQ_Rush)',
          Accept: 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      }
    );

    if (!response.ok) {
      return null;
    }

    const results = await response.json();
    if (!Array.isArray(results) || !results.length) {
      return null;
    }

    const lat = Number(results[0].lat);
    const lon = Number(results[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    const location = await getLocationFromCoords(lat, lon);
    return {
      lat,
      lon,
      grid: latLonToGridSquare(lat, lon),
      city: location?.city || city || '',
      province: location?.state || province || '',
      country: 'Canada'
    };
  } catch (error) {
    console.error('Canadian callsign geocode error:', error.message || error);
    return null;
  }
}

function latLonToGridSquare(lat, lon) {
  const adjLon = lon + 180;
  const adjLat = lat + 90;
  const field1 = Math.floor(adjLon / 20);
  const field2 = Math.floor(adjLat / 10);
  const square1 = Math.floor((adjLon % 20) / 2);
  const square2 = Math.floor(adjLat % 10);

  return String.fromCharCode(65 + field1)
    + String.fromCharCode(65 + field2)
    + square1
    + square2;
}

async function fetchLookupHtml(url, options = {}) {
  const fetchImpl = resolveFetch();
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      'User-Agent': 'CQ-Rush/1.2.1 (Field Day logger; +https://github.com/RandomActsofFrank/CQ_Rush)',
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      ...(options.headers || {})
    },
    signal: options.signal || AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Canadian lookup HTTP ${response.status}`);
  }

  return response.text();
}

async function lookupIsedCallsign(callsign) {
  const normalized = String(callsign || '').toUpperCase();
  const body = new URLSearchParams({
    p_callsign: normalized,
    p_surname: '',
    p_city: '',
    p_province: '',
    p_postal_code: ''
  });

  const html = await fetchLookupHtml(ISED_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString(),
    signal: AbortSignal.timeout(12000)
  });

  return parseIsedSearchHtml(html, normalized);
}

async function lookupFoxhollowCallsign(callsign) {
  const normalized = String(callsign || '').toUpperCase();
  const body = new URLSearchParams({ keywords: normalized });
  const seenUrls = new Set();
  const mirrorUrls = FOXHOLLOW_LOOKUP_URLS.filter((url) => {
    const normalizedUrl = String(url || '').trim();
    if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
      return false;
    }
    seenUrls.add(normalizedUrl);
    return true;
  });

  let lastError = null;

  for (const mirrorUrl of mirrorUrls) {
    try {
      const html = await fetchLookupHtml(mirrorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString(),
        signal: AbortSignal.timeout(10000)
      });
      const parsed = parseFoxhollowHtml(html, normalized);
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      lastError = error;
      console.error(`Foxhollow mirror ${mirrorUrl} failed for ${normalized}:`, error.message || error);
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

async function buildLookupResult(parsed, source) {
  if (!parsed?.callsign) {
    return null;
  }

  const geo = parsed.city || parsed.postalCode
    ? await geocodeCanadianLocation(parsed.city, parsed.province, parsed.postalCode)
    : null;

  const name = parsed.name || '';
  const city = geo?.city || parsed.city || '';
  const province = parsed.province || geo?.province || '';
  const grid = geo?.grid || '';

  return {
    success: true,
    source,
    name,
    callsign: parsed.callsign,
    grid,
    city,
    state: province,
    country: 'Canada',
    isExpired: false,
    expiryDate: '',
    isClub: !!parsed.isClub,
    cacheRecord: {
      callsign: parsed.callsign,
      name,
      grid,
      city,
      state: province,
      country: 'Canada',
      timestamp: new Date()
    }
  };
}

async function lookupCanadianCallsign(callsign) {
  const normalized = String(callsign || '').toUpperCase();

  if (!isCanadianCallsign(normalized)) {
    return null;
  }

  try {
    const mirror = await lookupFoxhollowCallsign(normalized);
    const mirrorResult = await buildLookupResult(mirror, 'ised-mirror');
    if (mirrorResult) {
      return mirrorResult;
    }
  } catch (error) {
    console.error(`Canadian mirror lookup failed for ${normalized}:`, error.message || error);
  }

  try {
    const ised = await lookupIsedCallsign(normalized);
    const isedResult = await buildLookupResult(ised, 'ised');
    if (isedResult) {
      return isedResult;
    }
  } catch (error) {
    console.error(`ISED lookup failed for ${normalized}:`, error.message || error);
  }

  return null;
}

module.exports = {
  isCanadianCallsign,
  parseFoxhollowHtml,
  parseIsedSearchHtml,
  latLonToGridSquare,
  lookupCanadianCallsign
};
