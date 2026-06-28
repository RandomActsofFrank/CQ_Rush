require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

const prisma = require('./lib/prisma');
const { serializeRecord, serializeRecords } = require('./lib/serialize');
const {
  requireSiteAuth,
  requireAdminAuth,
  hasAdminAccess,
  verifySitePassword,
  verifyAdminPassword
} = require('./lib/auth');
const { buildAuthStatus } = require('./lib/authStatus');
const {
  getActiveUserSessionId,
  setActiveUserSession,
  clearActiveUserSession,
  destroySessionById
} = require('./lib/userSessions');
const {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  verifyUserPassword,
  changeUserPassword,
  normalizeCallsign
} = require('./lib/users');
const {
  getAppConfig,
  updateAppConfig,
  ensureAppConfigConfigured,
  toPublicConfig
} = require('./lib/appConfig');
const {
  getStationSettings,
  saveStationSettings
} = require('./lib/stationSettings');
const {
  listContests,
  getActiveContest,
  getActiveContestSlug,
  setActiveContestSlug,
  ensureContestsConfigured,
  toPublicContest
} = require('./lib/contests');
const {
  normalizeDateInput,
  isValidDateRange,
  suggestedFieldDayDateRange
} = require('./lib/oneByOneLookup');
const {
  getCacheMeta,
  getRefreshCooldownInfo,
  startOneByOneCacheRefresh,
  isOneByOneCacheRefreshRunning
} = require('./lib/oneByOneCache');
const {
  LOOKUP_DELAY_MS,
  delay,
  isContactNameMissing,
  resolveCallsignLookup,
  toPublicLookupResponse,
  applyLookupToContact
} = require('./lib/callsignLookupService');

const app = express();
const PORT = process.env.PORT || 3002;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  app.set('trust proxy', 1);
}

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

if (process.env.APP_URL) {
  allowedOrigins.push(process.env.APP_URL);
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(session({
  store: new pgSession({
    pool: sessionPool,
    tableName: 'sessions',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'hamlog-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // Secure cookies only work over HTTPS — EC2 HTTP deployments need secure: false
    secure: process.env.COOKIE_SECURE === 'true' || (process.env.APP_URL || '').startsWith('https://'),
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

async function trackContactChange(contactId, action, oldData, newData, operator) {
  await prisma.contactHistory.create({
    data: {
      contactId: BigInt(contactId),
      action,
      oldData: oldData || undefined,
      newData: newData || undefined,
      operator: operator || 'Unknown',
      changeId: `${Date.now()}-${Math.random()}`
    }
  });
}

function resolveContactOperator(req, clientOperator) {
  const sessionCallsign = req.session?.userCallsign;
  if (sessionCallsign) {
    return normalizeCallsign(sessionCallsign) || String(sessionCallsign).trim().toUpperCase();
  }

  const trimmed = String(clientOperator || '').trim();
  if (trimmed) {
    return trimmed.toUpperCase();
  }

  return 'Admin';
}

async function updateDuplicateFlags() {
  const activeOperators = await prisma.activeOperator.findMany();

  const bandModeGroups = {};
  activeOperators.forEach((op) => {
    if (op.frequency && op.mode) {
      const key = `${op.frequency}-${op.mode}`;
      if (!bandModeGroups[key]) {
        bandModeGroups[key] = [];
      }
      bandModeGroups[key].push(op);
    }
  });

  for (const op of activeOperators) {
    let duplicateUser = 'N';

    if (op.frequency && op.mode) {
      const key = `${op.frequency}-${op.mode}`;
      const group = bandModeGroups[key];

      if (group && group.length > 1) {
        const sortedGroup = group.sort(
          (a, b) => new Date(a.bandModeTimestamp || a.timestamp) - new Date(b.bandModeTimestamp || b.timestamp)
        );
        duplicateUser = sortedGroup[0].callsign === op.callsign ? 'N' : 'Y';
      }
    }

    if (op.duplicateUser !== duplicateUser) {
      await prisma.activeOperator.update({
        where: { callsign: op.callsign },
        data: { duplicateUser }
      });
    }
  }
}

async function getActiveContestContactWhere(extra = {}) {
  const contestSlug = await getActiveContestSlug();
  return {
    contestSlug,
    ...extra
  };
}

function buildContactData(body, existing = {}) {
  const {
    callsign,
    frequency,
    mode,
    classSent,
    locationReceived,
    callSignArea,
    name,
    notes,
    rstSent,
    rstReceived,
    operator
  } = body;

  return {
    callsign: callsign != null
      ? String(callsign).trim().toUpperCase()
      : existing.callsign,
    frequency: frequency ?? existing.frequency,
    mode: mode ?? existing.mode,
    classSent: classSent ?? existing.classSent,
    locationReceived: locationReceived ?? existing.locationReceived,
    callSignArea: callSignArea ?? existing.callSignArea,
    name: name ?? existing.name,
    notes: notes ?? existing.notes,
    rstSent: rstSent ?? existing.rstSent,
    rstReceived: rstReceived ?? existing.rstReceived,
    createdBy: existing.createdBy || operator || 'Unknown',
    lastEditedBy: operator || existing.lastEditedBy || 'Unknown'
  };
}

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running', timestamp: new Date().toISOString() });
});

app.get('/api/auth/status', async (req, res) => {
  res.json(await buildAuthStatus(req));
});

app.get('/api/auth/me', async (req, res) => {
  const status = await buildAuthStatus(req);
  res.json({
    authenticated: status.siteAuthenticated,
    ...status
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { password, callsign, forceDisconnect } = req.body || {};
  const config = await getAppConfig();

  if (config.authMode === 'user_accounts') {
    if (!callsign || !password) {
      return res.status(400).json({ error: 'Callsign and password are required' });
    }

    const user = await verifyUserPassword(callsign, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid callsign or password' });
    }

    const existingSessionId = await getActiveUserSessionId(user.callsign);
    const currentSessionId = req.sessionID;

    if (existingSessionId && existingSessionId !== currentSessionId) {
      if (!forceDisconnect) {
        return res.status(409).json({
          error: 'This account is already signed in on another device.',
          sessionConflict: true
        });
      }

      try {
        await prisma.activeOperator.delete({ where: { callsign: user.callsign } });
        await updateDuplicateFlags();
      } catch {
        // Operator may already be removed
      }

      await destroySessionById(existingSessionId);
    }

    req.session.siteAuthenticated = true;
    req.session.userCallsign = user.callsign;
    req.session.userIsAdmin = user.isAdmin;
    req.session.adminAuthenticated = user.isAdmin;

    req.session.save(async (error) => {
      if (error) {
        console.error('Failed to save login session:', error);
        return res.status(500).json({ error: 'Unable to sign in' });
      }

      try {
        await setActiveUserSession(user.callsign, req.sessionID);
        res.json({
          success: true,
          callsign: user.callsign,
          isAdmin: user.isAdmin
        });
      } catch (saveError) {
        console.error('Failed to record active session:', saveError);
        res.status(500).json({ error: 'Unable to sign in' });
      }
    });
    return;
  }

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const valid = await verifySitePassword(password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  req.session.siteAuthenticated = true;
  req.session.userCallsign = null;
  req.session.userIsAdmin = false;
  res.json({ success: true });
});

app.post('/api/auth/admin/login', async (req, res) => {
  const { password } = req.body || {};

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const valid = await verifyAdminPassword(password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }

  req.session.adminAuthenticated = true;
  res.json({ success: true });
});

app.post('/api/auth/logout', async (req, res) => {
  const sessionCallsign = req.session?.userCallsign;
  const bodyCallsign = req.body?.callsign;
  const callsign = String(bodyCallsign || sessionCallsign || '').trim().toUpperCase();

  if (callsign) {
    try {
      await prisma.activeOperator.delete({ where: { callsign } });
      await updateDuplicateFlags();
    } catch {
      // Operator may already be removed
    }
  }

  if (sessionCallsign && req.sessionID) {
    await clearActiveUserSession(sessionCallsign, req.sessionID);
  }

  if (!req.session) {
    return res.json({ success: true });
  }

  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: 'Unable to log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.post('/api/auth/admin/logout', (req, res) => {
  if (req.session) {
    req.session.adminAuthenticated = false;
  }
  res.json({ success: true });
});

app.post('/api/auth/logout-all', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: 'Unable to log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const config = await getAppConfig();
    if (config.authMode !== 'user_accounts') {
      return res.status(400).json({ error: 'Password change is only available for operator accounts' });
    }

    if (!req.session?.siteAuthenticated || !req.session?.userCallsign) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { currentPassword, newPassword } = req.body || {};
    await changeUserPassword(req.session.userCallsign, currentPassword, newPassword);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to change password:', error);
    res.status(400).json({ error: error.message || 'Unable to change password' });
  }
});

const PUBLIC_READ_API_PATHS = new Set([
  '/contacts',
  '/active-operators',
  '/station-settings',
  '/contests',
  '/contests/active'
]);

app.use('/api', async (req, res, next) => {
  if (
    req.path === '/test'
    || req.path.startsWith('/auth/')
    || (req.method === 'GET' && PUBLIC_READ_API_PATHS.has(req.path))
  ) {
    return next();
  }

  if (await hasAdminAccess(req)) {
    return next();
  }

  return requireSiteAuth(req, res, next);
});

app.get('/api/app-config', requireAdminAuth, async (req, res) => {
  res.json(toPublicConfig(await getAppConfig()));
});

app.put('/api/app-config', requireAdminAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const updated = await updateAppConfig({
      clubName: body.clubName,
      authMode: body.authMode,
      siteLoginEnabled: body.siteLoginEnabled,
      newSitePassword: body.newSitePassword || null,
      newAdminPassword: body.newAdminPassword || null,
      clearSitePassword: Boolean(body.clearSitePassword),
      clearAdminPassword: Boolean(body.clearAdminPassword)
    });
    res.json(toPublicConfig(updated));
  } catch (error) {
    console.error('Failed to save app config:', error);
    res.status(500).json({ error: 'Failed to save security settings' });
  }
});

app.get('/api/users', requireAdminAuth, async (req, res) => {
  try {
    res.json(await listUsers());
  } catch (error) {
    console.error('Failed to list users:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

app.post('/api/users', requireAdminAuth, async (req, res) => {
  try {
    const { callsign, password, isAdmin } = req.body || {};
    const user = await createUser({ callsign, password, isAdmin });
    res.status(201).json(user);
  } catch (error) {
    console.error('Failed to create user:', error);
    res.status(400).json({ error: error.message || 'Failed to create user' });
  }
});

app.put('/api/users/:callsign', requireAdminAuth, async (req, res) => {
  try {
    const { password, isAdmin } = req.body || {};
    const user = await updateUser(req.params.callsign, { password, isAdmin });
    res.json(user);
  } catch (error) {
    console.error('Failed to update user:', error);
    res.status(400).json({ error: error.message || 'Failed to update user' });
  }
});

app.delete('/api/users/:callsign', requireAdminAuth, async (req, res) => {
  try {
    await deleteUser(req.params.callsign);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(400).json({ error: error.message || 'Failed to delete user' });
  }
});

app.get('/api/station-settings', async (req, res) => {
  const settings = await getStationSettings();
  res.json(settings);
});

app.put('/api/station-settings', requireAdminAuth, async (req, res) => {
  try {
    const settings = await saveStationSettings(req.body || {});
    res.json(settings);
  } catch (error) {
    console.error('Failed to save station settings:', error);
    res.status(500).json({ error: 'Failed to save station settings' });
  }
});

app.get('/api/contests', async (req, res) => {
  const contests = await listContests();
  res.json(contests.map((contest) => toPublicContest(contest, false)));
});

app.get('/api/contests/active', async (req, res) => {
  res.json(await getActiveContest(true));
});

app.put('/api/contests/active', requireAdminAuth, async (req, res) => {
  try {
    const { slug } = req.body || {};
    if (!slug) {
      return res.status(400).json({ error: 'Contest slug is required' });
    }

    await setActiveContestSlug(slug);
    res.json(await getActiveContest(true));
  } catch (error) {
    console.error('Failed to set active contest:', error);
    res.status(400).json({ error: error.message || 'Failed to set active contest' });
  }
});

app.get('/api/contacts', async (req, res) => {
  const contacts = await prisma.contact.findMany({
    where: await getActiveContestContactWhere({ deleted: { not: 'Y' } }),
    orderBy: { timestamp: 'desc' }
  });
  res.json(serializeRecords(contacts));
});

app.get('/api/contacts/all', async (req, res) => {
  const contacts = await prisma.contact.findMany({
    where: await getActiveContestContactWhere(),
    orderBy: { timestamp: 'desc' }
  });
  res.json(serializeRecords(contacts));
});

app.post('/api/contacts', async (req, res) => {
  const contactId = BigInt(Date.now());
  const operator = resolveContactOperator(req, req.body.operator);
  const contactData = buildContactData(req.body);
  const contestSlug = await getActiveContestSlug();

  const newContact = await prisma.contact.create({
    data: {
      id: contactId,
      timestamp: new Date(),
      deleted: 'N',
      contestSlug,
      ...contactData
    }
  });

  await trackContactChange(contactId, 'created', null, serializeRecord(newContact), operator);
  res.status(201).json(serializeRecord(newContact));
});

app.put('/api/contacts/:id', async (req, res) => {
  const contactId = BigInt(req.params.id);
  const existing = await prisma.contact.findUnique({ where: { id: contactId } });

  if (!existing) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  const operator = resolveContactOperator(req, req.body.operator);
  const updatedData = buildContactData(req.body, existing);

  const updatedContact = await prisma.contact.update({
    where: { id: contactId },
    data: {
      ...updatedData,
      lastEditedAt: new Date()
    }
  });

  await trackContactChange(
    contactId,
    'updated',
    serializeRecord(existing),
    serializeRecord(updatedContact),
    operator
  );

  res.json(serializeRecord(updatedContact));
});

app.delete('/api/contacts/clear', requireAdminAuth, async (req, res) => {
  const contestSlug = await getActiveContestSlug();
  const contactIds = await prisma.contact.findMany({
    where: { contestSlug },
    select: { id: true }
  });

  if (contactIds.length > 0) {
    await prisma.contactHistory.deleteMany({
      where: {
        contactId: { in: contactIds.map((row) => row.id) }
      }
    });
  }

  await prisma.contact.deleteMany({ where: { contestSlug } });
  res.status(204).send();
});

app.delete('/api/contacts/:id', async (req, res) => {
  const contactId = BigInt(req.params.id);
  const existing = await prisma.contact.findUnique({ where: { id: contactId } });

  if (!existing) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  const operator = resolveContactOperator(req, req.query.operator);
  const deletedContact = await prisma.contact.update({
    where: { id: contactId },
    data: {
      deleted: 'Y',
      deletedBy: operator,
      deletedAt: new Date()
    }
  });

  await trackContactChange(
    contactId,
    'deleted',
    serializeRecord(existing),
    serializeRecord(deletedContact),
    operator
  );

  res.status(204).send();
});

app.put('/api/contacts/:id/restore', async (req, res) => {
  const contactId = BigInt(req.params.id);
  const existing = await prisma.contact.findUnique({ where: { id: contactId } });

  if (!existing) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  const operator = resolveContactOperator(req, req.body.operator);
  const restoredContact = await prisma.contact.update({
    where: { id: contactId },
    data: {
      deleted: 'N',
      restoredBy: operator,
      restoredAt: new Date()
    }
  });

  await trackContactChange(
    contactId,
    'restored',
    serializeRecord(existing),
    serializeRecord(restoredContact),
    operator
  );

  res.json(serializeRecord(restoredContact));
});

app.post('/api/contacts/refresh-lookup', requireAdminAuth, async (req, res) => {
  const missingOnly = req.body?.missingOnly !== false;
  const includeDeleted = Boolean(req.body?.includeDeleted);
  const preferLocalCache = Boolean(req.body?.preferLocalCache);
  const networkOnly = Boolean(req.body?.networkOnly);
  const operator = resolveContactOperator(req, req.body?.operator);

  try {
    let contacts = await prisma.contact.findMany({
      where: await getActiveContestContactWhere(
        includeDeleted ? {} : { deleted: { not: 'Y' } }
      ),
      orderBy: { timestamp: 'desc' }
    });

    if (missingOnly) {
      contacts = contacts.filter((contact) => isContactNameMissing(contact.name));
    }

    const summary = {
      scanned: contacts.length,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      failed: 0,
      results: []
    };

    for (let index = 0; index < contacts.length; index += 1) {
      const contact = contacts[index];
      const lookup = await resolveCallsignLookup(prisma, contact.callsign, {
        preferLocalCache,
        networkOnly
      });

      if (!lookup?.success) {
        summary.failed += 1;
        summary.results.push({
          contactId: String(contact.id),
          callsign: contact.callsign,
          status: 'failed'
        });
      } else {
        const existing = contact;
        const outcome = await applyLookupToContact(prisma, contact, lookup, operator);

        if (outcome.status === 'updated') {
          await trackContactChange(
            contact.id,
            'updated',
            serializeRecord(existing),
            serializeRecord(outcome.contact),
            operator
          );
          summary.updated += 1;
        } else if (outcome.status === 'unchanged') {
          summary.unchanged += 1;
        } else {
          summary.skipped += 1;
        }

        summary.results.push(outcome);
      }

      if (index < contacts.length - 1 && LOOKUP_DELAY_MS > 0) {
        await delay(LOOKUP_DELAY_MS);
      }
    }

    res.json({
      success: true,
      missingOnly,
      preferLocalCache,
      networkOnly,
      message: `Refreshed ${summary.updated} of ${summary.scanned} log entries (${summary.failed} failed).`,
      ...summary
    });
  } catch (error) {
    console.error('Bulk contact lookup refresh error:', error);
    res.status(500).json({ error: 'Unable to refresh logbook lookup data.' });
  }
});

app.post('/api/contacts/:id/refresh-lookup', requireAdminAuth, async (req, res) => {
  const contactId = BigInt(req.params.id);
  const preferLocalCache = Boolean(req.body?.preferLocalCache);
  const networkOnly = Boolean(req.body?.networkOnly);
  const operator = resolveContactOperator(req, req.body?.operator);

  try {
    const existing = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const lookup = await resolveCallsignLookup(prisma, existing.callsign, {
      preferLocalCache,
      networkOnly
    });

    if (!lookup?.success) {
      return res.status(404).json({
        error: `No lookup data found for ${existing.callsign}.`,
        callsign: existing.callsign
      });
    }

    const outcome = await applyLookupToContact(prisma, existing, lookup, operator);
    if (outcome.status === 'updated') {
      await trackContactChange(
        contactId,
        'updated',
        serializeRecord(existing),
        serializeRecord(outcome.contact),
        operator
      );
    }

    res.json({
      success: true,
      ...outcome,
      lookupSource: lookup.source || 'lookup',
      contact: serializeRecord(outcome.contact || existing)
    });
  } catch (error) {
    console.error('Contact lookup refresh error:', error);
    res.status(500).json({ error: 'Unable to refresh contact lookup data.' });
  }
});

app.get('/api/callsigns', async (req, res) => {
  const callsigns = await prisma.callsignLookup.findMany({
    orderBy: { timestamp: 'desc' }
  });
  res.json(callsigns);
});

app.get('/api/contacts/history/all', async (req, res) => {
  const contestSlug = await getActiveContestSlug();
  const contactIds = await prisma.contact.findMany({
    where: { contestSlug },
    select: { id: true }
  });

  const history = await prisma.contactHistory.findMany({
    where: {
      contactId: { in: contactIds.map((row) => row.id) }
    },
    orderBy: { timestamp: 'desc' }
  });
  res.json(serializeRecords(history));
});

app.get('/api/contacts/:id/history', async (req, res) => {
  const contactId = BigInt(req.params.id);
  const history = await prisma.contactHistory.findMany({
    where: { contactId },
    orderBy: { timestamp: 'desc' }
  });
  res.json(serializeRecords(history));
});

app.get('/api/active-operators', async (req, res) => {
  const operators = await prisma.activeOperator.findMany({
    orderBy: { timestamp: 'desc' }
  });
  res.json(operators);
});

app.post('/api/active-operators', async (req, res) => {
  const operatorData = req.body;
  const timestamp = operatorData.timestamp ? new Date(operatorData.timestamp) : new Date();
  const bandModeTimestamp = operatorData.bandModeTimestamp
    ? new Date(operatorData.bandModeTimestamp)
    : null;

  const savedOperator = await prisma.activeOperator.upsert({
    where: { callsign: operatorData.callsign },
    create: {
      callsign: operatorData.callsign,
      name: operatorData.name,
      frequency: operatorData.frequency,
      mode: operatorData.mode,
      duplicateUser: operatorData.duplicateUser || 'N',
      timestamp,
      bandModeTimestamp
    },
    update: {
      name: operatorData.name,
      frequency: operatorData.frequency,
      mode: operatorData.mode,
      duplicateUser: operatorData.duplicateUser || 'N',
      timestamp,
      bandModeTimestamp
    }
  });

  await updateDuplicateFlags();
  res.status(201).json(savedOperator);
});

app.put('/api/active-operators/:callsign', async (req, res) => {
  const { callsign } = req.params;
  const operatorData = req.body;

  try {
    const updatedOperator = await prisma.activeOperator.update({
      where: { callsign },
      data: {
        name: operatorData.name,
        frequency: operatorData.frequency,
        mode: operatorData.mode,
        duplicateUser: operatorData.duplicateUser || 'N',
        timestamp: operatorData.timestamp ? new Date(operatorData.timestamp) : new Date(),
        bandModeTimestamp: operatorData.bandModeTimestamp
          ? new Date(operatorData.bandModeTimestamp)
          : null
      }
    });

    await updateDuplicateFlags();
    res.json(updatedOperator);
  } catch (error) {
    res.status(404).json({ error: 'Operator not found' });
  }
});

app.delete('/api/active-operators/:callsign', async (req, res) => {
  const { callsign } = req.params;

  try {
    await prisma.activeOperator.delete({ where: { callsign } });
    await updateDuplicateFlags();
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Operator not found' });
  }
});

app.get('/api/active-operators/cleanup', async (req, res) => {
  const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000));
  const result = await prisma.activeOperator.deleteMany({
    where: {
      timestamp: {
        lt: twoHoursAgo
      }
    }
  });

  res.json({
    message: `Cleaned up ${result.count} inactive operators`,
    remaining: await prisma.activeOperator.count()
  });
});

app.get('/api/one-by-one/cache/status', requireAdminAuth, async (req, res) => {
  try {
    const meta = await getCacheMeta(prisma);
    const defaults = suggestedFieldDayDateRange();
    const cooldown = getRefreshCooldownInfo(meta);
    res.json({
      ...meta,
      ...cooldown,
      running: isOneByOneCacheRefreshRunning(),
      suggestedStartDate: defaults.startDate,
      suggestedEndDate: defaults.endDate
    });
  } catch (error) {
    console.error('1x1 cache status error:', error);
    res.status(500).json({ error: 'Unable to read 1×1 cache status' });
  }
});

app.post('/api/one-by-one/cache/refresh', requireAdminAuth, async (req, res) => {
  if (isOneByOneCacheRefreshRunning()) {
    return res.status(409).json({ error: 'A 1×1 cache refresh is already running.' });
  }

  const startDate = normalizeDateInput(req.body?.startDate);
  const endDate = normalizeDateInput(req.body?.endDate);

  if (!isValidDateRange(startDate, endDate)) {
    return res.status(400).json({
      error: 'startDate and endDate are required (YYYY-MM-DD) and startDate must be on or before endDate.'
    });
  }

  try {
    const meta = await getCacheMeta(prisma);
    const cooldown = getRefreshCooldownInfo(meta);
    if (!cooldown.canRefresh) {
      return res.status(429).json({
        error: cooldown.cooldownMessage || '1×1 cache refresh is on cooldown.',
        nextRefreshAt: cooldown.nextRefreshAt,
        remainingMs: cooldown.remainingMs,
        cooldownHours: cooldown.cooldownHours
      });
    }
  } catch (error) {
    console.error('1x1 cache cooldown check error:', error);
    return res.status(500).json({ error: 'Unable to verify 1×1 cache refresh cooldown.' });
  }

  startOneByOneCacheRefresh(prisma, { startDate, endDate }).catch((error) => {
    console.error('1x1 cache refresh failed:', error);
  });

  res.status(202).json({
    success: true,
    message: `1×1 cache refresh started for ${startDate} – ${endDate}.`,
    startDate,
    endDate
  });
});

app.get('/api/lookup/:callsign', async (req, res) => {
  const callsign = req.params.callsign.toUpperCase();

  try {
    const result = await resolveCallsignLookup(prisma, callsign);
    res.json(toPublicLookupResponse(result || { success: false }));
  } catch (error) {
    console.error('Callsign lookup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error looking up callsign'
    });
  }
});

app.use(express.static(path.join(__dirname, '../client/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

async function startServer() {
  await ensureAppConfigConfigured();
  await ensureContestsConfigured();

  app.listen(PORT, () => {
    console.log(`Ham Radio Contest Logger server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
