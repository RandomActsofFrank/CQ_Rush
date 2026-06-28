require('dotenv').config();
const { ensureAppConfigConfigured } = require('./lib/appConfig');
const { ensureContestsConfigured } = require('./lib/contests');

async function main() {
  await ensureAppConfigConfigured();
  await ensureContestsConfigured();
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
