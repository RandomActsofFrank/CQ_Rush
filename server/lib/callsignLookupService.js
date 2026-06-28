const { lookupCallookCallsign } = require('./callookLookup');
const { isCanadianCallsign, lookupCanadianCallsign } = require('./canadianCallsignLookup');
const {
  isOneByOneCallsign,
  lookupOneByOneCallsign
} = require('./oneByOneLookup');
const {
  lookupCachedOneByOne,
  enrichReservationWithCallook
} = require('./oneByOneCache');

const LOOKUP_DELAY_MS = Number(process.env.CONTACT_LOOKUP_DELAY_MS || 100);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLookupDisplayName(result) {
  if (!result) {
    return '';
  }

  return String(result.name || result.eventName || result.holderName || '').trim();
}

function isContactNameMissing(name) {
  return !String(name || '').trim();
}

async function lookupFromLocalCache(prisma, callsign) {
  const normalized = String(callsign || '').toUpperCase();
  const row = await prisma.callsignLookup.findUnique({
    where: { callsign: normalized }
  });

  if (!row) {
    return null;
  }

  return {
    success: true,
    source: 'local-cache',
    name: row.name || '',
    callsign: normalized,
    grid: row.grid || '',
    city: row.city || '',
    state: row.state || '',
    country: row.country || '',
    expiryDate: '',
    isExpired: false,
    specialEvent: false
  };
}

async function enrichOneByOneWithHolderLocation(result) {
  if (!result?.holderCallsign) {
    return result;
  }

  if (result.grid && result.name) {
    return result;
  }

  try {
    const enriched = await enrichReservationWithCallook({
      requestorCall: result.holderCallsign,
      licenseName: result.name,
      grid: result.grid,
      city: result.city,
      state: result.state,
      country: result.country
    });

    return {
      ...result,
      name: enriched.licenseName || result.name || '',
      grid: enriched.grid || result.grid || '',
      city: enriched.city || result.city || '',
      state: enriched.state || result.state || '',
      country: enriched.country || result.country || '',
      holderName: enriched.licenseName || result.holderName || result.requestor || ''
    };
  } catch (error) {
    console.error('1x1 holder Callook enrichment error:', error.message || error);
    return result;
  }
}

async function lookupCallsignLive(prisma, callsign) {
  const normalized = String(callsign || '').toUpperCase();
  let result = null;

  if (isOneByOneCallsign(normalized)) {
    result = await lookupCachedOneByOne(prisma, normalized);
    if (result) {
      result = await enrichOneByOneWithHolderLocation(result);
    }

    if (!result?.success) {
      try {
        result = await lookupOneByOneCallsign(normalized);
        if (result?.success) {
          result = await enrichOneByOneWithHolderLocation(result);
        }
      } catch (error) {
        console.error('1x1 callsign lookup error:', error.message || error);
      }
    }
  }

  if (!result?.success && isCanadianCallsign(normalized)) {
    result = await lookupCanadianCallsign(normalized);
  }

  if (!result?.success) {
    result = await lookupCallookCallsign(normalized);
  }

  return result?.success ? result : null;
}

async function persistLookupCache(prisma, result) {
  if (!result?.callsign) {
    return;
  }

  const record = result.cacheRecord || {
    callsign: result.callsign,
    name: getLookupDisplayName(result),
    grid: result.grid || '',
    city: result.city || '',
    state: result.state || '',
    country: result.country || '',
    timestamp: new Date()
  };

  await prisma.callsignLookup.upsert({
    where: { callsign: record.callsign },
    create: record,
    update: {
      name: record.name,
      grid: record.grid,
      city: record.city,
      state: record.state,
      country: record.country,
      timestamp: new Date()
    }
  });
}

async function resolveCallsignLookup(prisma, callsign, options = {}) {
  const normalized = String(callsign || '').toUpperCase();
  const preferLocalCache = Boolean(options.preferLocalCache);
  const networkOnly = Boolean(options.networkOnly);

  if (preferLocalCache && !networkOnly) {
    const cached = await lookupFromLocalCache(prisma, normalized);
    if (cached) {
      return cached;
    }
  }

  let result = null;

  try {
    result = await lookupCallsignLive(prisma, normalized);
    if (result) {
      try {
        await persistLookupCache(prisma, result);
      } catch (cacheError) {
        console.error(
          `Lookup cache persist failed for ${normalized}:`,
          cacheError.message || cacheError
        );
      }
      return result;
    }
  } catch (error) {
    console.error(`Live lookup failed for ${normalized}:`, error.message || error);
  }

  if (!networkOnly) {
    return lookupFromLocalCache(prisma, normalized);
  }

  return null;
}

function toPublicLookupResponse(result) {
  if (!result?.success) {
    return {
      success: false,
      message: 'Callsign not found'
    };
  }

  return {
    success: true,
    name: result.name,
    callsign: result.callsign,
    grid: result.grid || '',
    city: result.city || '',
    state: result.state || '',
    country: result.country || '',
    expiryDate: result.expiryDate || '',
    isExpired: !!result.isExpired,
    source: result.source || 'callook',
    specialEvent: !!result.specialEvent,
    eventName: result.eventName || '',
    coordinator: result.coordinator || '',
    requestor: result.requestor || '',
    requestorAddr: result.requestorAddr || '',
    holderCallsign: result.holderCallsign || '',
    holderName: result.holderName || '',
    startDate: result.startDate || '',
    endDate: result.endDate || ''
  };
}

async function applyLookupToContact(prisma, contact, lookupResult, operator) {
  const name = getLookupDisplayName(lookupResult);
  if (!name) {
    return { status: 'skipped', reason: 'no_name', callsign: contact.callsign };
  }

  if (contact.name === name) {
    return { status: 'unchanged', callsign: contact.callsign, name };
  }

  const updatedContact = await prisma.contact.update({
    where: { id: contact.id },
    data: {
      name,
      lastEditedBy: operator,
      lastEditedAt: new Date()
    }
  });

  return {
    status: 'updated',
    contactId: String(contact.id),
    callsign: contact.callsign,
    name,
    source: lookupResult.source || 'lookup',
    contact: updatedContact
  };
}

module.exports = {
  LOOKUP_DELAY_MS,
  delay,
  getLookupDisplayName,
  isContactNameMissing,
  resolveCallsignLookup,
  lookupCallsignLive,
  persistLookupCache,
  toPublicLookupResponse,
  applyLookupToContact
};
