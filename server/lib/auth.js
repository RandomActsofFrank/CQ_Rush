const {
  isSiteLoginRequired,
  isAdminLoginRequired,
  verifySitePassword,
  verifyAdminPassword,
  getAppConfig
} = require('./appConfig');
const { getUserCount } = require('./users');
const { isCurrentUserSession } = require('./userSessions');

async function requireSiteAuth(req, res, next) {
  const required = await isSiteLoginRequired();

  if (!required) {
    return next();
  }

  if (req.session && req.session.siteAuthenticated) {
    if (!(await isCurrentUserSession(req))) {
      return res.status(401).json({ error: 'Session ended on another device' });
    }
    return next();
  }

  return res.status(401).json({ error: 'Authentication required' });
}

async function hasAdminAccess(req) {
  const config = await getAppConfig();

  if (config.authMode === 'user_accounts') {
    const userCount = await getUserCount();
    if (userCount === 0) {
      return true;
    }

    if (req.session && req.session.siteAuthenticated && req.session.userIsAdmin) {
      return isCurrentUserSession(req);
    }

    return false;
  }

  const required = await isAdminLoginRequired();

  if (!required) {
    return true;
  }

  return Boolean(req.session && req.session.adminAuthenticated);
}

async function requireAdminAuth(req, res, next) {
  const config = await getAppConfig();

  if (config.authMode === 'user_accounts') {
    const userCount = await getUserCount();
    if (userCount === 0) {
      return next();
    }

    if (req.session && req.session.siteAuthenticated && req.session.userIsAdmin) {
      if (!(await isCurrentUserSession(req))) {
        return res.status(401).json({ error: 'Session ended on another device' });
      }
      return next();
    }
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const required = await isAdminLoginRequired();

  if (!required) {
    return next();
  }

  if (req.session && req.session.adminAuthenticated) {
    return next();
  }

  return res.status(401).json({ error: 'Admin authentication required' });
}

module.exports = {
  requireSiteAuth,
  requireAdminAuth,
  hasAdminAccess,
  verifySitePassword,
  verifyAdminPassword,
  isSiteLoginRequired,
  isAdminLoginRequired
};
