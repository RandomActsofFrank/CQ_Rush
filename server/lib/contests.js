const prisma = require('./prisma');
const {
  DEFAULT_STATION_SETTINGS,
  normalizeSettings
} = require('./stationSettingsDefaults');

const STATION_SETTINGS_KEY = 'station_settings';
const ACTIVE_CONTEST_KEY = 'active_contest_slug';
const DEFAULT_CONTEST_SLUG = 'field-day';

const CONTEST_DEFINITIONS = [
  {
    slug: DEFAULT_CONTEST_SLUG,
    name: 'ARRL Field Day',
    ruleset: 'field-day',
    sortOrder: 0
  }
];

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toPublicContest(contest, includeSettings = false) {
  if (!contest) {
    return null;
  }

  const payload = {
    slug: contest.slug,
    name: contest.name,
    ruleset: contest.ruleset,
    sortOrder: contest.sortOrder
  };

  if (includeSettings) {
    payload.settings = normalizeSettings(contest.settings || {});
  }

  return payload;
}

async function getActiveContestSlug() {
  const config = await prisma.siteConfig.findUnique({
    where: { key: ACTIVE_CONTEST_KEY }
  });

  const slug = normalizeSlug(config?.value) || DEFAULT_CONTEST_SLUG;
  const contest = await prisma.contest.findUnique({ where: { slug } });
  return contest ? slug : DEFAULT_CONTEST_SLUG;
}

async function setActiveContestSlug(slug) {
  const normalized = normalizeSlug(slug);
  const contest = await prisma.contest.findUnique({ where: { slug: normalized } });
  if (!contest) {
    throw new Error(`Unknown contest: ${slug}`);
  }

  await prisma.siteConfig.upsert({
    where: { key: ACTIVE_CONTEST_KEY },
    create: {
      key: ACTIVE_CONTEST_KEY,
      value: normalized
    },
    update: {
      value: normalized
    }
  });

  return normalized;
}

async function listContests() {
  return prisma.contest.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  });
}

async function getContest(slug) {
  return prisma.contest.findUnique({
    where: { slug: normalizeSlug(slug) }
  });
}

async function getActiveContest(includeSettings = true) {
  const slug = await getActiveContestSlug();
  const contest = await prisma.contest.findUnique({ where: { slug } });
  if (!contest) {
    return toPublicContest(
      {
        slug: DEFAULT_CONTEST_SLUG,
        name: 'ARRL Field Day',
        ruleset: 'field-day',
        sortOrder: 0,
        settings: DEFAULT_STATION_SETTINGS
      },
      includeSettings
    );
  }

  return toPublicContest(contest, includeSettings);
}

async function getContestSettings(slug) {
  const contest = await getContest(slug);
  if (!contest) {
    return normalizeSettings();
  }

  return normalizeSettings(contest.settings || {});
}

async function saveContestSettings(slug, settings) {
  const normalized = normalizeSlug(slug);
  const merged = normalizeSettings(settings);
  const contest = await prisma.contest.findUnique({ where: { slug: normalized } });
  if (!contest) {
    throw new Error(`Unknown contest: ${slug}`);
  }

  await prisma.contest.update({
    where: { slug: normalized },
    data: { settings: merged }
  });

  return merged;
}

async function getActiveContestSettings() {
  const slug = await getActiveContestSlug();
  return getContestSettings(slug);
}

async function saveActiveContestSettings(settings) {
  const slug = await getActiveContestSlug();
  return saveContestSettings(slug, settings);
}

async function migrateLegacyStationSettings() {
  const legacy = await prisma.siteConfig.findUnique({
    where: { key: STATION_SETTINGS_KEY }
  });

  if (!legacy) {
    return;
  }

  let parsed = {};
  try {
    parsed = JSON.parse(legacy.value);
  } catch {
    parsed = {};
  }

  const contest = await prisma.contest.findUnique({
    where: { slug: DEFAULT_CONTEST_SLUG }
  });

  if (!contest) {
    return;
  }

  const existingSettings = contest.settings || {};
  const hasContestSettings = existingSettings
    && typeof existingSettings === 'object'
    && Object.keys(existingSettings).length > 0;

  if (!hasContestSettings) {
    await prisma.contest.update({
      where: { slug: DEFAULT_CONTEST_SLUG },
      data: { settings: normalizeSettings(parsed) }
    });
  }
}

async function ensureContestsConfigured() {
  for (const definition of CONTEST_DEFINITIONS) {
    await prisma.contest.upsert({
      where: { slug: definition.slug },
      create: {
        ...definition,
        settings: definition.slug === DEFAULT_CONTEST_SLUG
          ? normalizeSettings(DEFAULT_STATION_SETTINGS)
          : {}
      },
      update: {
        name: definition.name,
        ruleset: definition.ruleset,
        sortOrder: definition.sortOrder
      }
    });
  }

  await migrateLegacyStationSettings();

  const activeConfig = await prisma.siteConfig.findUnique({
    where: { key: ACTIVE_CONTEST_KEY }
  });

  if (!activeConfig) {
    await prisma.siteConfig.create({
      data: {
        key: ACTIVE_CONTEST_KEY,
        value: DEFAULT_CONTEST_SLUG
      }
    });
  }
}

module.exports = {
  ACTIVE_CONTEST_KEY,
  DEFAULT_CONTEST_SLUG,
  CONTEST_DEFINITIONS,
  normalizeSlug,
  listContests,
  getContest,
  getActiveContest,
  getActiveContestSlug,
  setActiveContestSlug,
  getContestSettings,
  saveContestSettings,
  getActiveContestSettings,
  saveActiveContestSettings,
  ensureContestsConfigured,
  toPublicContest
};
