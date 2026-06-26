#!/usr/bin/env node
/**
 * Reset site/admin passwords from SSH (run inside the app container or server directory).
 *
 * Examples:
 *   node scripts/reset-auth.js --clear-all
 *   node scripts/reset-auth.js --set-site-password "MyNewPassword"
 *   node scripts/reset-auth.js --set-admin-password "AdminPass123"
 *   node scripts/reset-auth.js --disable-site-login
 *   node scripts/reset-auth.js --clear-admin-password
 */
require('dotenv').config();

const {
  getAppConfig,
  updateAppConfig,
  hashPassword
} = require('../lib/appConfig');

function printUsage() {
  console.log(`
Usage: node scripts/reset-auth.js [options]

Options:
  --set-site-password <password>   Enable site login with this password
  --set-admin-password <password>  Set admin panel password
  --disable-site-login             Turn off site login and clear site password
  --clear-admin-password           Remove admin password (admin panel open)
  --clear-all                      Remove all passwords and disable site login
  --show                           Show current auth configuration (no secrets)
  --help                           Show this help
`);
}

function parseArgs(argv) {
  const options = {
    show: false,
    help: false,
    clearAll: false,
    disableSiteLogin: false,
    clearAdminPassword: false,
    setSitePassword: null,
    setAdminPassword: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help') options.help = true;
    else if (arg === '--show') options.show = true;
    else if (arg === '--clear-all') options.clearAll = true;
    else if (arg === '--disable-site-login') options.disableSiteLogin = true;
    else if (arg === '--clear-admin-password') options.clearAdminPassword = true;
    else if (arg === '--set-site-password') {
      options.setSitePassword = argv[i + 1];
      i += 1;
    } else if (arg === '--set-admin-password') {
      options.setAdminPassword = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  if (options.show) {
    const config = await getAppConfig();
    console.log('Current auth configuration:');
    console.log(`  Club name:          ${config.clubName}`);
    console.log(`  Site login enabled: ${config.siteLoginEnabled}`);
    console.log(`  Site password set:  ${Boolean(config.sitePasswordHash)}`);
    console.log(`  Admin password set: ${Boolean(config.adminPasswordHash)}`);
    return;
  }

  const hasAction = options.clearAll
    || options.disableSiteLogin
    || options.clearAdminPassword
    || options.setSitePassword
    || options.setAdminPassword;

  if (!hasAction) {
    printUsage();
    process.exit(1);
  }

  if (options.clearAll) {
    await updateAppConfig({
      clearSitePassword: true,
      clearAdminPassword: true
    });
    console.log('Cleared all passwords and disabled site login.');
    return;
  }

  if (options.disableSiteLogin) {
    await updateAppConfig({ clearSitePassword: true });
    console.log('Site login disabled and site password cleared.');
  }

  if (options.clearAdminPassword) {
    await updateAppConfig({ clearAdminPassword: true });
    console.log('Admin password cleared.');
  }

  if (options.setSitePassword) {
    if (options.setSitePassword.length < 4) {
      throw new Error('Site password must be at least 4 characters.');
    }
    await updateAppConfig({ newSitePassword: options.setSitePassword });
    console.log('Site login password updated and site login enabled.');
  }

  if (options.setAdminPassword) {
    if (options.setAdminPassword.length < 4) {
      throw new Error('Admin password must be at least 4 characters.');
    }
    await updateAppConfig({ newAdminPassword: options.setAdminPassword });
    console.log('Admin password updated.');
  }
}

main()
  .catch((error) => {
    console.error('Reset failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = require('../lib/prisma');
    await prisma.$disconnect();
  });
