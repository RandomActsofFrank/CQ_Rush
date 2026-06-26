// ARRL section boundary rules for US-only map rendering.
// Source: https://www.arrl.org/section-boundaries
//
// Rule shape:
// - { section: 'EPA', state: 'PA', counties: ['Adams', ...] }
// - { section: 'DE', wholeState: 'DE' }

export const ARRL_SECTION_RULES = [
  // Atlantic Division
  { section: 'DE', wholeState: 'DE' },
  {
    section: 'EPA',
    state: 'PA',
    counties: [
      'Adams', 'Berks', 'Bradford', 'Bucks', 'Carbon', 'Chester', 'Columbia',
      'Cumberland', 'Dauphin', 'Delaware', 'Juniata', 'Lackawanna', 'Lancaster',
      'Lebanon', 'Lehigh', 'Luzerne', 'Lycoming', 'Monroe', 'Montgomery',
      'Montour', 'Northampton', 'Northumberland', 'Perry', 'Philadelphia', 'Pike',
      'Schuylkill', 'Snyder', 'Sullivan', 'Susquehanna', 'Tioga', 'Union',
      'Wayne', 'Wyoming', 'York'
    ]
  },
  { section: 'MDC', wholeState: 'MD' },
  { section: 'MDC', wholeState: 'DC' },
  {
    section: 'WPA',
    state: 'PA',
    counties: [
      'Allegheny', 'Armstrong', 'Beaver', 'Bedford', 'Blair', 'Butler', 'Cambria',
      'Cameron', 'Centre', 'Clarion', 'Clearfield', 'Clinton', 'Crawford', 'Elk',
      'Erie', 'Fayette', 'Forest', 'Franklin', 'Fulton', 'Greene', 'Huntingdon',
      'Indiana', 'Jefferson', 'Lawrence', 'McKean', 'Mercer', 'Mifflin', 'Potter',
      'Somerset', 'Venango', 'Warren', 'Washington', 'Westmoreland'
    ]
  },
  {
    section: 'NNY',
    state: 'NY',
    counties: [
      'Clinton', 'Essex', 'Franklin', 'Fulton', 'Hamilton', 'Jefferson', 'Lewis',
      'Montgomery', 'St. Lawrence', 'Schoharie'
    ]
  },
  {
    section: 'SNJ',
    state: 'NJ',
    counties: [
      'Atlantic', 'Burlington', 'Camden', 'Cape May', 'Cumberland', 'Gloucester',
      'Mercer', 'Ocean', 'Salem'
    ]
  },
  {
    section: 'WNY',
    state: 'NY',
    counties: [
      'Allegany', 'Broome', 'Cattaraugus', 'Cayuga', 'Chautauqua', 'Chemung',
      'Chenango', 'Cortland', 'Delaware', 'Erie', 'Genesee', 'Herkimer',
      'Livingston', 'Madison', 'Monroe', 'Niagara', 'Oneida', 'Onondaga',
      'Ontario', 'Orleans', 'Oswego', 'Otsego', 'Schuyler', 'Seneca', 'Steuben',
      'Tioga', 'Tompkins', 'Wayne', 'Wyoming', 'Yates'
    ]
  },

  // Central Division
  { section: 'IL', wholeState: 'IL' },
  { section: 'IN', wholeState: 'IN' },
  { section: 'WI', wholeState: 'WI' },

  // Dakota Division
  { section: 'MN', wholeState: 'MN' },
  { section: 'ND', wholeState: 'ND' },
  { section: 'SD', wholeState: 'SD' },

  // Delta Division
  { section: 'AR', wholeState: 'AR' },
  { section: 'LA', wholeState: 'LA' },
  { section: 'MS', wholeState: 'MS' },
  { section: 'TN', wholeState: 'TN' },

  // Great Lakes Division
  { section: 'KY', wholeState: 'KY' },
  { section: 'MI', wholeState: 'MI' },
  { section: 'OH', wholeState: 'OH' },

  // Hudson Division
  {
    section: 'ENY',
    state: 'NY',
    counties: [
      'Albany', 'Columbia', 'Dutchess', 'Greene', 'Orange', 'Putnam', 'Rensselaer',
      'Rockland', 'Saratoga', 'Schenectady', 'Sullivan', 'Ulster', 'Warren',
      'Washington', 'Westchester'
    ]
  },
  {
    section: 'NLI',
    state: 'NY',
    counties: ['Bronx', 'Kings', 'Nassau', 'New York', 'Queens', 'Richmond', 'Suffolk']
  },
  {
    section: 'NNJ',
    state: 'NJ',
    counties: [
      'Bergen', 'Essex', 'Hudson', 'Hunterdon', 'Middlesex', 'Monmouth', 'Morris',
      'Passaic', 'Somerset', 'Sussex', 'Union', 'Warren'
    ]
  },

  // Midwest Division
  { section: 'IA', wholeState: 'IA' },
  { section: 'KS', wholeState: 'KS' },
  { section: 'MO', wholeState: 'MO' },
  { section: 'NE', wholeState: 'NE' },

  // New England Division
  { section: 'CT', wholeState: 'CT' },
  {
    section: 'EMA',
    state: 'MA',
    counties: [
      'Barnstable', 'Bristol', 'Dukes', 'Essex', 'Middlesex', 'Nantucket',
      'Norfolk', 'Plymouth', 'Suffolk'
    ]
  },
  { section: 'ME', wholeState: 'ME' },
  { section: 'NH', wholeState: 'NH' },
  { section: 'RI', wholeState: 'RI' },
  { section: 'VT', wholeState: 'VT' },
  {
    section: 'WMA',
    state: 'MA',
    counties: ['Berkshire', 'Franklin', 'Hampden', 'Hampshire', 'Worcester']
  },

  // Northwestern Division
  { section: 'AK', wholeState: 'AK' },
  {
    section: 'EWA',
    state: 'WA',
    counties: [
      'Adams', 'Asotin', 'Benton', 'Chelan', 'Columbia', 'Douglas', 'Ferry',
      'Franklin', 'Garfield', 'Grant', 'Kittitas', 'Klickitat', 'Lincoln',
      'Okanogan', 'Pend Oreille', 'Spokane', 'Stevens', 'Walla Walla', 'Whitman',
      'Yakima'
    ]
  },
  { section: 'ID', wholeState: 'ID' },
  { section: 'MT', wholeState: 'MT' },
  { section: 'OR', wholeState: 'OR' },
  {
    section: 'WWA',
    state: 'WA',
    counties: [
      'Clallam', 'Clark', 'Cowlitz', 'Grays Harbor', 'Island', 'Jefferson', 'King',
      'Kitsap', 'Lewis', 'Mason', 'Pacific', 'Pierce', 'San Juan', 'Skagit',
      'Skamania', 'Snohomish', 'Thurston', 'Wahkiakum', 'Whatcom'
    ]
  },

  // Pacific Division
  {
    section: 'EB',
    state: 'CA',
    counties: ['Alameda', 'Contra Costa', 'Napa', 'Solano']
  },
  { section: 'NV', wholeState: 'NV' },
  { section: 'PAC', wholeState: 'HI' },
  {
    section: 'SV',
    state: 'CA',
    counties: [
      'Alpine', 'Amador', 'Butte', 'Colusa', 'El Dorado', 'Glenn', 'Lassen',
      'Modoc', 'Nevada', 'Placer', 'Plumas', 'Sacramento', 'Shasta', 'Sierra',
      'Siskiyou', 'Sutter', 'Tehama', 'Trinity', 'Yolo', 'Yuba'
    ]
  },
  {
    section: 'SF',
    state: 'CA',
    counties: ['Del Norte', 'Humboldt', 'Lake', 'Marin', 'Mendocino', 'San Francisco', 'Sonoma']
  },
  {
    section: 'SJV',
    state: 'CA',
    counties: [
      'Calaveras', 'Fresno', 'Kern', 'Kings', 'Madera', 'Mariposa', 'Merced',
      'Mono', 'San Joaquin', 'Stanislaus', 'Tulare', 'Tuolumne'
    ]
  },
  {
    section: 'SCV',
    state: 'CA',
    counties: ['Monterey', 'San Benito', 'San Mateo', 'Santa Clara', 'Santa Cruz']
  },

  // Roanoke Division
  { section: 'NC', wholeState: 'NC' },
  { section: 'SC', wholeState: 'SC' },
  { section: 'VA', wholeState: 'VA' },
  { section: 'WV', wholeState: 'WV' },

  // Rocky Mountain Division
  { section: 'CO', wholeState: 'CO' },
  { section: 'NM', wholeState: 'NM' },
  { section: 'UT', wholeState: 'UT' },
  { section: 'WY', wholeState: 'WY' },

  // Southeastern Division
  { section: 'AL', wholeState: 'AL' },
  { section: 'GA', wholeState: 'GA' },
  {
    section: 'NFL',
    state: 'FL',
    counties: [
      'Alachua', 'Baker', 'Bay', 'Bradford', 'Calhoun', 'Citrus', 'Clay',
      'Columbia', 'Dixie', 'Duval', 'Escambia', 'Flagler', 'Franklin', 'Gadsden',
      'Gilchrist', 'Gulf', 'Hamilton', 'Hernando', 'Holmes', 'Jackson', 'Jefferson',
      'Lafayette', 'Lake', 'Leon', 'Levy', 'Liberty', 'Madison', 'Marion', 'Nassau',
      'Okaloosa', 'Orange', 'Putnam', 'Santa Rosa', 'Seminole', 'St. Johns',
      'Sumter', 'Suwannee', 'Taylor', 'Union', 'Volusia', 'Wakulla', 'Walton',
      'Washington'
    ]
  },
  { section: 'PR', wholeState: 'PR' },
  {
    section: 'SFL',
    state: 'FL',
    counties: [
      'Brevard', 'Broward', 'Collier', 'Miami-Dade', 'Glades', 'Hendry',
      'Indian River', 'Lee', 'Martin', 'Monroe', 'Okeechobee', 'Osceola',
      'Palm Beach', 'St. Lucie'
    ]
  },
  { section: 'VI', wholeState: 'VI' },
  {
    section: 'WCF',
    state: 'FL',
    counties: [
      'Charlotte', 'DeSoto', 'Hardee', 'Highlands', 'Hillsborough', 'Manatee',
      'Pasco', 'Pinellas', 'Polk', 'Sarasota'
    ]
  },

  // Southwestern Division
  { section: 'AZ', wholeState: 'AZ' },
  { section: 'LAX', state: 'CA', counties: ['Los Angeles'] },
  {
    section: 'ORG',
    state: 'CA',
    counties: ['Inyo', 'Orange', 'Riverside', 'San Bernardino']
  },
  { section: 'SDG', state: 'CA', counties: ['Imperial', 'San Diego'] },
  {
    section: 'SB',
    state: 'CA',
    counties: ['San Luis Obispo', 'Santa Barbara', 'Ventura']
  },

  // West Gulf Division
  {
    section: 'NTX',
    state: 'TX',
    counties: [
      'Anderson', 'Archer', 'Baylor', 'Bell', 'Bosque', 'Bowie', 'Brown', 'Camp',
      'Cass', 'Cherokee', 'Clay', 'Collin', 'Comanche', 'Cooke', 'Coryell',
      'Dallas', 'Delta', 'Denton', 'Eastland', 'Ellis', 'Erath', 'Falls', 'Fannin',
      'Franklin', 'Freestone', 'Grayson', 'Gregg', 'Hamilton', 'Harrison',
      'Henderson', 'Hill', 'Hood', 'Hopkins', 'Hunt', 'Jack', 'Johnson', 'Kaufman',
      'Lamar', 'Lampasas', 'Limestone', 'McLennan', 'Marion', 'Mills', 'Montague',
      'Morris', 'Nacogdoches', 'Navarro', 'Palo Pinto', 'Panola', 'Parker',
      'Rains', 'Red River', 'Rockwall', 'Rusk', 'Shelby', 'Smith', 'Somervell',
      'Stephens', 'Tarrant', 'Throckmorton', 'Titus', 'Upshur', 'Van Zandt',
      'Wichita', 'Wilbarger', 'Wise', 'Wood', 'Young'
    ]
  },
  { section: 'OK', wholeState: 'OK' },
  {
    section: 'STX',
    state: 'TX',
    counties: [
      'Angelina', 'Aransas', 'Atascosa', 'Austin', 'Bandera', 'Bastrop', 'Bee',
      'Bexar', 'Blanco', 'Brazoria', 'Brazos', 'Brooks', 'Burleson', 'Burnet',
      'Caldwell', 'Calhoun', 'Cameron', 'Chambers', 'Colorado', 'Comal', 'Concho',
      'DeWitt', 'Dimmit', 'Duval', 'Edwards', 'Fayette', 'Fort Bend', 'Frio',
      'Galveston', 'Gillespie', 'Goliad', 'Gonzales', 'Grimes', 'Guadalupe',
      'Hardin', 'Harris', 'Hays', 'Hidalgo', 'Houston', 'Jackson', 'Jasper',
      'Jefferson', 'Jim Hogg', 'Jim Wells', 'Karnes', 'Kendall', 'Kenedy', 'Kerr',
      'Kimble', 'Kinney', 'Kleberg', 'La Salle', 'Lavaca', 'Lee', 'Leon', 'Liberty',
      'Live Oak', 'Llano', 'Madison', 'Mason', 'Matagorda', 'Maverick',
      'McCulloch', 'McMullen', 'Medina', 'Menard', 'Milam', 'Montgomery', 'Newton',
      'Nueces', 'Orange', 'Polk', 'Real', 'Refugio', 'Robertson', 'Sabine',
      'San Augustine', 'San Jacinto', 'San Patricio', 'San Saba', 'Starr', 'Travis',
      'Trinity', 'Tyler', 'Uvalde', 'Val Verde', 'Victoria', 'Walker', 'Waller',
      'Washington', 'Webb', 'Wharton', 'Willacy', 'Williamson', 'Wilson', 'Zapata',
      'Zavala'
    ]
  },
  {
    section: 'WTX',
    state: 'TX',
    counties: [
      'Andrews', 'Armstrong', 'Bailey', 'Borden', 'Brewster', 'Briscoe', 'Callahan',
      'Carson', 'Castro', 'Childress', 'Cochran', 'Coke', 'Coleman', 'Collingsworth',
      'Cottle', 'Crane', 'Crockett', 'Crosby', 'Culberson', 'Dallam', 'Dawson',
      'Deaf Smith', 'Dickens', 'Donley', 'Ector', 'El Paso', 'Fisher', 'Floyd',
      'Foard', 'Gaines', 'Garza', 'Glasscock', 'Gray', 'Hale', 'Hall', 'Hansford',
      'Hardeman', 'Hartley', 'Haskell', 'Hemphill', 'Hockley', 'Howard', 'Hudspeth',
      'Hutchinson', 'Irion', 'Jeff Davis', 'Jones', 'Kent', 'King', 'Knox', 'Lamb',
      'Lipscomb', 'Loving', 'Lubbock', 'Lynn', 'Martin', 'Midland', 'Mitchell',
      'Moore', 'Motley', 'Nolan', 'Ochiltree', 'Oldham', 'Parmer', 'Pecos', 'Potter',
      'Presidio', 'Randall', 'Reagan', 'Reeves', 'Roberts', 'Runnels', 'Schleicher',
      'Scurry', 'Shackelford', 'Sherman', 'Sterling', 'Stonewall', 'Sutton',
      'Swisher', 'Taylor', 'Terrell', 'Terry', 'Tom Green', 'Upton', 'Ward',
      'Wheeler', 'Winkler', 'Yoakum'
    ]
  }
];

export const ARRL_SECTION_NAMES = {
  AK: 'Alaska',
  AL: 'Alabama',
  AR: 'Arkansas',
  AZ: 'Arizona',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  EB: 'East Bay',
  EMA: 'Eastern Massachusetts',
  ENY: 'Eastern New York',
  EPA: 'Eastern Pennsylvania',
  EWA: 'Eastern Washington',
  GA: 'Georgia',
  IA: 'Iowa',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  LAX: 'Los Angeles',
  MDC: 'Maryland-DC',
  ME: 'Maine',
  MI: 'Michigan',
  MN: 'Minnesota',
  MO: 'Missouri',
  MS: 'Mississippi',
  MT: 'Montana',
  NC: 'North Carolina',
  ND: 'North Dakota',
  NE: 'Nebraska',
  NFL: 'Northern Florida',
  NH: 'New Hampshire',
  NLI: 'New York City-Long Island',
  NM: 'New Mexico',
  NNJ: 'Northern New Jersey',
  NNY: 'Northern New York',
  NTX: 'North Texas',
  NV: 'Nevada',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  ORG: 'Orange',
  PAC: 'Pacific',
  PR: 'Puerto Rico',
  RI: 'Rhode Island',
  SB: 'Santa Barbara',
  SC: 'South Carolina',
  SCV: 'Santa Clara Valley',
  SD: 'South Dakota',
  SDG: 'San Diego',
  SF: 'San Francisco',
  SFL: 'Southern Florida',
  SJV: 'San Joaquin Valley',
  SNJ: 'Southern New Jersey',
  STX: 'South Texas',
  SV: 'Sacramento Valley',
  TN: 'Tennessee',
  UT: 'Utah',
  VA: 'Virginia',
  VI: 'US Virgin Islands',
  VT: 'Vermont',
  WCF: 'West Central Florida',
  WI: 'Wisconsin',
  WMA: 'Western Massachusetts',
  WNY: 'Western New York',
  WPA: 'Western Pennsylvania',
  WTX: 'West Texas',
  WWA: 'Western Washington',
  WV: 'West Virginia',
  WY: 'Wyoming'
};

const normalizeCountyName = (value = '') =>
  String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+(County|Parish|Borough|Municipality|Census Area)$/i, '')
    .toLowerCase();

const RULES_BY_STATE = ARRL_SECTION_RULES.reduce((acc, rule) => {
  const state = (rule.state || rule.wholeState || '').toUpperCase();
  if (!state) return acc;
  if (!acc[state]) acc[state] = [];
  acc[state].push(rule);
  return acc;
}, {});

// Returns ARRL section abbreviation for the provided state/county pair.
// If countyName is omitted and the state has a whole-state section, that section is returned.
export function getSectionForCounty(stusps, countyName) {
  const state = String(stusps || '').toUpperCase().trim();
  const rules = RULES_BY_STATE[state] || [];

  if (!rules.length) return null;

  const normalizedCounty = normalizeCountyName(countyName);

  // Prefer county-specific rules for split sections.
  if (normalizedCounty) {
    for (const rule of rules) {
      if (!rule.counties) continue;
      const matched = rule.counties.some((county) => normalizeCountyName(county) === normalizedCounty);
      if (matched) return rule.section;
    }
  }

  // Fallback to whole-state sections.
  const wholeStateRule = rules.find((rule) => rule.wholeState);
  return wholeStateRule ? wholeStateRule.section : null;
}
