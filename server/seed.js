require('dotenv').config();
const { ensureAppConfigConfigured } = require('./lib/appConfig');
const { ensureStationSettingsConfigured } = require('./lib/stationSettings');

async function main() {
  await ensureAppConfigConfigured();
  await ensureStationSettingsConfigured();
  console.log('Database seed complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = require('./lib/prisma');
    await prisma.$disconnect();
  });
