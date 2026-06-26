const { getAppConfig, toPublicConfig } = require('./appConfig');
const { getUserCount } = require('./users');
const { isCurrentUserSession } = require('./userSessions');
const { APP_NAME } = require('./branding');

async function buildAuthStatus(req) {
  const config = await getAppConfig();
  const userCount = config.authMode === 'user_accounts' ? await getUserCount() : 0;
  const userAuthEnabled = config.authMode === 'user_accounts' && userCount > 0;

  const siteLoginRequired = userAuthEnabled
    || (config.authMode !== 'user_accounts' && config.siteLoginEnabled && Boolean(config.sitePasswordHash));

  let siteAuthenticated = !siteLoginRequired || Boolean(req.session && req.session.siteAuthenticated);

  if (
    siteAuthenticated
    && userAuthEnabled
    && req.session?.userCallsign
    && !(await isCurrentUserSession(req))
  ) {
    siteAuthenticated = false;
  }

  let adminLoginRequired = false;
  let adminAuthenticated = true;

  if (config.authMode === 'user_accounts') {
    adminAuthenticated = Boolean(
      siteAuthenticated
      && req.session
      && req.session.userIsAdmin
    );
  } else {
    adminLoginRequired = Boolean(config.adminPasswordHash);
    adminAuthenticated = !adminLoginRequired || Boolean(req.session && req.session.adminAuthenticated);
  }

  return {
    ...toPublicConfig(config),
    appName: APP_NAME,
    authMode: config.authMode,
    userAuthEnabled,
    userCount,
    siteLoginRequired,
    siteAuthenticated,
    adminLoginRequired,
    adminAuthenticated,
    userCallsign: req.session?.userCallsign || null,
    userIsAdmin: Boolean(req.session?.userIsAdmin)
  };
}

module.exports = { buildAuthStatus };
