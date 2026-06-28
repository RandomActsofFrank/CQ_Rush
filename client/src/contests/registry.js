export const CONTEST_REGISTRY = {
  'field-day': {
    slug: 'field-day',
    name: 'ARRL Field Day',
    ruleset: 'field-day',
    brandingSuffix: 'ARRL Field Day Logbook',
    displayMapTitle: 'ARRL Sections Progress',
    showSectionsMap: true,
    exportFormats: ['cabrillo', 'adif']
  }
};

export function getContestDefinition(slug) {
  return CONTEST_REGISTRY[slug] || null;
}

export function getContestDisplayTitle(slug, fallback = 'Contest Progress') {
  return getContestDefinition(slug)?.displayMapTitle || fallback;
}
