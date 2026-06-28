const {
  ONE_BY_ONE_SEARCH_URL,
  ONE_BY_ONE_CACHE_META_KEY,
  buildOneByOneDateRangeSearchUrl,
  normalizeDateInput,
  isValidDateRange,
  parseOneByOneDetailPage,
  parseOneByOneSearchResultsPage,
  extractDetailIds,
  pickBestReservation,
  reservationToLookupResult,
  fetchOneByOneHtml,
  delay
} = require('./oneByOneLookup');
const { lookupCallookCallsign } = require('./callookLookup');

const DEFAULT_REQUEST_DELAY_MS = Number(process.env.ONE_BY_ONE_REQUEST_DELAY_MS || 150);
const DEFAULT_DETAIL_CONCURRENCY = Number(process.env.ONE_BY_ONE_DETAIL_CONCURRENCY || 3);
const REFRESH_COOLDOWN_MS = Number(process.env.ONE_BY_ONE_REFRESH_COOLDOWN_MS || 72 * 60 * 60 * 1000);

let refreshPromise = null;

function getRefreshCooldownInfo(meta = {}) {
  const cooldownHours = REFRESH_COOLDOWN_MS / (60 * 60 * 1000);

  if (meta.status === 'error') {
    return {
      canRefresh: true,
      cooldownHours,
      cooldownBypassed: true,
      cooldownMessage: 'Last refresh failed — you can retry immediately.'
    };
  }

  if (meta.status === 'complete' && meta.refreshedAt) {
    const lastRefreshMs = new Date(meta.refreshedAt).getTime();
    if (!Number.isNaN(lastRefreshMs)) {
      const elapsedMs = Date.now() - lastRefreshMs;
      if (elapsedMs < REFRESH_COOLDOWN_MS) {
        const nextRefreshAt = new Date(lastRefreshMs + REFRESH_COOLDOWN_MS).toISOString();
        return {
          canRefresh: false,
          cooldownHours,
          cooldownBypassed: false,
          nextRefreshAt,
          remainingMs: REFRESH_COOLDOWN_MS - elapsedMs,
          cooldownMessage: `Cache was refreshed recently. Try again after ${nextRefreshAt} (${cooldownHours}-hour cooldown).`
        };
      }
    }
  }

  return {
    canRefresh: true,
    cooldownHours,
    cooldownBypassed: false,
    cooldownMessage: null
  };
}

function assertRefreshAllowed(meta) {
  const cooldown = getRefreshCooldownInfo(meta);
  if (!cooldown.canRefresh) {
    const error = new Error(cooldown.cooldownMessage || '1×1 cache refresh is on cooldown.');
    error.code = 'REFRESH_COOLDOWN';
    error.nextRefreshAt = cooldown.nextRefreshAt;
    error.remainingMs = cooldown.remainingMs;
    throw error;
  }
  return cooldown;
}

async function getCacheMeta(prisma) {
  const row = await prisma.siteConfig.findUnique({
    where: { key: ONE_BY_ONE_CACHE_META_KEY }
  });

  if (!row) {
    return {
      status: 'idle',
      message: 'No local 1×1 cache yet.',
      reservationCount: 0,
      startDate: null,
      endDate: null,
      detailCount: 0,
      savedReservations: 0,
      refreshedAt: null,
      startedAt: null
    };
  }

  try {
    const parsed = JSON.parse(row.value);
    const reservationCount = await prisma.oneByOneReservation.count();
    return {
      ...parsed,
      reservationCount
    };
  } catch {
    return {
      status: 'error',
      message: 'Cache metadata is invalid.',
      reservationCount: await prisma.oneByOneReservation.count(),
      startDate: null,
      endDate: null,
      detailCount: 0,
      savedReservations: 0,
      refreshedAt: null,
      startedAt: null
    };
  }
}

async function saveCacheMeta(prisma, meta) {
  await prisma.siteConfig.upsert({
    where: { key: ONE_BY_ONE_CACHE_META_KEY },
    create: {
      key: ONE_BY_ONE_CACHE_META_KEY,
      value: JSON.stringify(meta)
    },
    update: {
      value: JSON.stringify(meta)
    }
  });
}

function parseDbDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function dbRowToReservation(row) {
  return {
    id: row.id,
    callsign: row.callsign,
    coordinator: row.coordinator || '',
    eventName: row.eventName || '',
    requestor: row.requestor || '',
    requestorCall: row.requestorCall || '',
    requestorAddr: row.requestorAddr || '',
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    licenseName: row.licenseName || '',
    grid: row.grid || '',
    city: row.city || '',
    state: row.state || '',
    country: row.country || ''
  };
}

async function enrichReservationWithCallook(reservation) {
  if (!reservation.requestorCall) {
    return reservation;
  }

  try {
    const holder = await lookupCallookCallsign(reservation.requestorCall);
    if (!holder) {
      return reservation;
    }

    return {
      ...reservation,
      licenseName: holder.name || reservation.licenseName || '',
      grid: holder.grid || reservation.grid || '',
      city: holder.city || reservation.city || '',
      state: holder.state || reservation.state || '',
      country: holder.country || reservation.country || ''
    };
  } catch (error) {
    console.error(`Callook enrichment failed for ${reservation.requestorCall}:`, error.message || error);
    return reservation;
  }
}

async function upsertReservation(prisma, reservation, cachedAt) {
  const startDate = parseDbDate(reservation.startDate);
  const endDate = parseDbDate(reservation.endDate);

  if (!reservation.id || !startDate || !endDate) {
    return false;
  }

  await prisma.oneByOneReservation.upsert({
    where: { id: reservation.id },
    create: {
      id: reservation.id,
      callsign: reservation.callsign,
      coordinator: reservation.coordinator || null,
      eventName: reservation.eventName || null,
      requestor: reservation.requestor || null,
      requestorCall: reservation.requestorCall || null,
      requestorAddr: reservation.requestorAddr || null,
      startDate,
      endDate,
      licenseName: reservation.licenseName || null,
      grid: reservation.grid || null,
      city: reservation.city || null,
      state: reservation.state || null,
      country: reservation.country || null,
      cachedAt
    },
    update: {
      callsign: reservation.callsign,
      coordinator: reservation.coordinator || null,
      eventName: reservation.eventName || null,
      requestor: reservation.requestor || null,
      requestorCall: reservation.requestorCall || null,
      requestorAddr: reservation.requestorAddr || null,
      startDate,
      endDate,
      licenseName: reservation.licenseName || null,
      grid: reservation.grid || null,
      city: reservation.city || null,
      state: reservation.state || null,
      country: reservation.country || null,
      cachedAt
    }
  });

  return true;
}

async function lookupCachedOneByOne(prisma, callsign, referenceDate = new Date()) {
  const normalized = String(callsign || '').toUpperCase();
  const rows = await prisma.oneByOneReservation.findMany({
    where: { callsign: normalized }
  });

  if (!rows.length) {
    return null;
  }

  const best = pickBestReservation(rows.map(dbRowToReservation), referenceDate);
  if (!best) {
    return null;
  }

  return reservationToLookupResult(best, '1x1-cache');
}

async function runCacheRefresh(prisma, options = {}) {
  const startDate = normalizeDateInput(options.startDate);
  const endDate = normalizeDateInput(options.endDate);

  if (!isValidDateRange(startDate, endDate)) {
    throw new Error('A valid startDate and endDate (YYYY-MM-DD) are required.');
  }

  const startedAt = new Date().toISOString();
  let errors = 0;

  await saveCacheMeta(prisma, {
    status: 'running',
    message: `Searching 1×1 reservations from ${startDate} to ${endDate}…`,
    startDate,
    endDate,
    detailCount: 0,
    savedReservations: 0,
    startedAt,
    refreshedAt: null
  });

  let searchHtml = '';
  let summaryRows = [];

  try {
    searchHtml = await fetchOneByOneHtml(
      buildOneByOneDateRangeSearchUrl(startDate, endDate)
    );
    summaryRows = parseOneByOneSearchResultsPage(searchHtml);
  } catch (error) {
    errors += 1;
    throw new Error(`1×1 date-range search failed: ${error.message || error}`);
  }

  const detailIds = [...new Set([
    ...summaryRows.map((row) => String(row.id)),
    ...extractDetailIds(searchHtml)
  ])].filter(Boolean);

  if (!detailIds.length) {
    const refreshedAt = new Date().toISOString();
    await saveCacheMeta(prisma, {
      status: 'complete',
      message: `No 1×1 reservations found between ${startDate} and ${endDate}.`,
      startDate,
      endDate,
      detailCount: 0,
      savedReservations: 0,
      startedAt,
      refreshedAt,
      errors
    });

    return {
      savedReservations: 0,
      removedStale: 0,
      errors,
      startDate,
      endDate
    };
  }

  const cachedAt = new Date();
  let savedReservations = 0;
  const savedIds = [];

  await saveCacheMeta(prisma, {
    status: 'running',
    message: `Downloading ${detailIds.length} reservation detail pages…`,
    startDate,
    endDate,
    detailCount: detailIds.length,
    savedReservations: 0,
    startedAt,
    refreshedAt: null,
    errors
  });

  for (let index = 0; index < detailIds.length; index += DEFAULT_DETAIL_CONCURRENCY) {
    const batch = detailIds.slice(index, index + DEFAULT_DETAIL_CONCURRENCY);
    const pages = await Promise.all(
      batch.map(async (id) => {
        try {
          const html = await fetchOneByOneHtml(`${ONE_BY_ONE_SEARCH_URL}?byid=${id}`);
          return parseOneByOneDetailPage(html, id);
        } catch (error) {
          errors += 1;
          console.error(`1x1 detail failed for id ${id}:`, error.message || error);
          return null;
        }
      })
    );

    for (const parsed of pages) {
      if (!parsed?.id) {
        continue;
      }

      const enriched = await enrichReservationWithCallook(parsed);
      const saved = await upsertReservation(prisma, enriched, cachedAt);
      if (saved) {
        savedReservations += 1;
        savedIds.push(enriched.id);
      }
    }

    await saveCacheMeta(prisma, {
      status: 'running',
      message: `Saved ${savedReservations}/${detailIds.length} reservations…`,
      startDate,
      endDate,
      detailCount: detailIds.length,
      savedReservations,
      startedAt,
      refreshedAt: null,
      errors
    });

    await delay(DEFAULT_REQUEST_DELAY_MS);
  }

  let removedStale = 0;
  if (savedIds.length > 0) {
    const removed = await prisma.oneByOneReservation.deleteMany({
      where: {
        startDate: { lte: parseDbDate(endDate) },
        endDate: { gte: parseDbDate(startDate) },
        id: { notIn: savedIds }
      }
    });
    removedStale = removed.count;
  }

  const refreshedAt = new Date().toISOString();
  await saveCacheMeta(prisma, {
    status: 'complete',
    message: `Cached ${savedReservations} reservations for ${startDate} – ${endDate} (${removedStale} stale removed).`,
    startDate,
    endDate,
    detailCount: detailIds.length,
    savedReservations,
    removedStale,
    startedAt,
    refreshedAt,
    errors
  });

  return {
    savedReservations,
    removedStale,
    errors,
    startDate,
    endDate
  };
}

function startOneByOneCacheRefresh(prisma, options = {}) {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const meta = await getCacheMeta(prisma);
      assertRefreshAllowed(meta);
      return await runCacheRefresh(prisma, options);
    } catch (error) {
      if (error.code !== 'REFRESH_COOLDOWN') {
        const previousMeta = await getCacheMeta(prisma);
        await saveCacheMeta(prisma, {
          status: 'error',
          message: error.message || '1×1 cache refresh failed.',
          startDate: normalizeDateInput(options.startDate) || null,
          endDate: normalizeDateInput(options.endDate) || null,
          detailCount: 0,
          savedReservations: 0,
          refreshedAt: previousMeta.refreshedAt || null,
          startedAt: new Date().toISOString()
        });
      }
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function isOneByOneCacheRefreshRunning() {
  return Boolean(refreshPromise);
}

module.exports = {
  getCacheMeta,
  getRefreshCooldownInfo,
  lookupCachedOneByOne,
  startOneByOneCacheRefresh,
  isOneByOneCacheRefreshRunning,
  enrichReservationWithCallook
};
