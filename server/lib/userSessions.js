const prisma = require('./prisma');
const { normalizeCallsign } = require('./users');

function isActiveSessionRecord(session, callsign) {
  if (!session || session.expire < new Date()) {
    return false;
  }

  const sess = session.sess || {};
  return Boolean(sess.siteAuthenticated && sess.userCallsign === callsign);
}

async function getActiveUserSessionId(callsign) {
  const normalized = normalizeCallsign(callsign);
  if (!normalized) {
    return null;
  }

  const user = await prisma.appUser.findUnique({
    where: { callsign: normalized },
    select: { activeSessionId: true }
  });

  if (!user?.activeSessionId) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { sid: user.activeSessionId }
  });

  if (!isActiveSessionRecord(session, normalized)) {
    await prisma.appUser.update({
      where: { callsign: normalized },
      data: { activeSessionId: null }
    });
    return null;
  }

  return user.activeSessionId;
}

async function setActiveUserSession(callsign, sessionId) {
  const normalized = normalizeCallsign(callsign);
  if (!normalized) {
    return;
  }

  await prisma.appUser.update({
    where: { callsign: normalized },
    data: { activeSessionId: sessionId || null }
  });
}

async function clearActiveUserSession(callsign, sessionId) {
  const normalized = normalizeCallsign(callsign);
  if (!normalized) {
    return;
  }

  const user = await prisma.appUser.findUnique({
    where: { callsign: normalized },
    select: { activeSessionId: true }
  });

  if (user?.activeSessionId === sessionId) {
    await prisma.appUser.update({
      where: { callsign: normalized },
      data: { activeSessionId: null }
    });
  }
}

async function destroySessionById(sessionId) {
  if (!sessionId) {
    return;
  }

  await prisma.session.delete({
    where: { sid: sessionId }
  }).catch(() => {});
}

async function isCurrentUserSession(req) {
  const callsign = req.session?.userCallsign;
  if (!callsign || !req.sessionID) {
    return true;
  }

  const user = await prisma.appUser.findUnique({
    where: { callsign: normalizeCallsign(callsign) },
    select: { activeSessionId: true }
  });

  return !user?.activeSessionId || user.activeSessionId === req.sessionID;
}

module.exports = {
  getActiveUserSessionId,
  setActiveUserSession,
  clearActiveUserSession,
  destroySessionById,
  isCurrentUserSession
};
