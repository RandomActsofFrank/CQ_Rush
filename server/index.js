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
const { isLicenseExpired } = require('./lib/callsignExpiry');
const {
  requireSiteAuth,
  requireAdminAuth,
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
  saveStationSettings,
  ensureStationSettingsConfigured
} = require('./lib/stationSettings');

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

function gridToLocation(gridSquare) {
  if (!gridSquare || gridSquare.length < 4) return null;

  const grid = gridSquare.toUpperCase();
  const field1 = grid.charCodeAt(0) - 65;
  const field2 = grid.charCodeAt(1) - 65;
  const square1 = parseInt(grid.charAt(2), 10);
  const square2 = parseInt(grid.charAt(3), 10);

  let lon = (field1 * 20) + (square1 * 2) - 180;
  let lat = (field2 * 10) + square2 - 90;

  if (grid.length >= 6) {
    const subsquare1 = grid.charCodeAt(4) - 65;
    const subsquare2 = grid.charCodeAt(5) - 65;
    lon += (subsquare1 * 5 / 60);
    lat += (subsquare2 * 2.5 / 60);
  }

  return { lat, lon };
}

async function getLocationFromCoords(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=6&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'HamRadioContestLogger/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }

    const data = await response.json();
    if (data.error) {
      return null;
    }

    const address = data.address || {};
    return {
      city: address.city || address.town || address.village || address.county || '',
      state: address.state || address.province || '',
      country: address.country || ''
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
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
    callsign: callsign ?? existing.callsign,
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
  '/station-settings'
]);

app.use('/api', (req, res, next) => {
  if (
    req.path === '/test'
    || req.path.startsWith('/auth/')
    || (req.method === 'GET' && PUBLIC_READ_API_PATHS.has(req.path))
  ) {
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

app.get('/api/contacts', async (req, res) => {
  const contacts = await prisma.contact.findMany({
    where: { deleted: { not: 'Y' } },
    orderBy: { timestamp: 'desc' }
  });
  res.json(serializeRecords(contacts));
});

app.get('/api/contacts/all', async (req, res) => {
  const contacts = await prisma.contact.findMany({
    orderBy: { timestamp: 'desc' }
  });
  res.json(serializeRecords(contacts));
});

app.post('/api/contacts', async (req, res) => {
  const contactId = BigInt(Date.now());
  const operator = req.body.operator || 'Unknown';
  const contactData = buildContactData(req.body);

  const newContact = await prisma.contact.create({
    data: {
      id: contactId,
      timestamp: new Date(),
      deleted: 'N',
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

  const operator = req.body.operator || 'Unknown';
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
  await prisma.contactHistory.deleteMany();
  await prisma.contact.deleteMany();
  res.status(204).send();
});

app.delete('/api/contacts/:id', async (req, res) => {
  const contactId = BigInt(req.params.id);
  const existing = await prisma.contact.findUnique({ where: { id: contactId } });

  if (!existing) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  const operator = req.query.operator || 'Unknown';
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

  const operator = req.body.operator || 'Unknown';
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

app.get('/api/callsigns', async (req, res) => {
  const callsigns = await prisma.callsignLookup.findMany({
    orderBy: { timestamp: 'desc' }
  });
  res.json(callsigns);
});

app.get('/api/contacts/history/all', async (req, res) => {
  const history = await prisma.contactHistory.findMany({
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

app.get('/api/lookup/:callsign', async (req, res) => {
  const { callsign } = req.params;

  try {
    const response = await fetch(`https://callook.info/${callsign.toUpperCase()}/json`);
    const data = await response.json();

    if (data.status === 'VALID') {
      const gridSquare = data.location?.gridsquare || '';
      let locationData = {
        city: '',
        state: data.location?.state || '',
        country: data.location?.country || ''
      };

      if (gridSquare) {
        const coords = gridToLocation(gridSquare);
        if (coords) {
          const detailedLocation = await getLocationFromCoords(coords.lat, coords.lon);
          if (detailedLocation) {
            locationData = {
              city: detailedLocation.city,
              state: detailedLocation.state || locationData.state,
              country: detailedLocation.country || locationData.country
            };
          }
        }
      }

      const expiryDate = data.otherInfo?.expiryDate || '';
      const expired = isLicenseExpired(expiryDate);

      const callsignData = {
        callsign: data.current?.callsign || callsign.toUpperCase(),
        name: data.name || '',
        grid: gridSquare,
        city: locationData.city,
        state: locationData.state,
        country: locationData.country,
        timestamp: new Date()
      };

      await prisma.callsignLookup.upsert({
        where: { callsign: callsignData.callsign },
        create: callsignData,
        update: callsignData
      });

      res.json({
        success: true,
        name: callsignData.name,
        callsign: callsignData.callsign,
        grid: callsignData.grid,
        city: callsignData.city,
        state: callsignData.state,
        country: callsignData.country,
        expiryDate,
        isExpired: expired
      });
    } else {
      res.json({
        success: false,
        message: 'Callsign not found'
      });
    }
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
  await ensureStationSettingsConfigured();

  app.listen(PORT, () => {
    console.log(`Ham Radio Contest Logger server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
