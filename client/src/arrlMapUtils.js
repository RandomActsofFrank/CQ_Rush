import { getSectionForCounty, ARRL_SECTION_NAMES } from './arrlSectionBoundaries';

const TERRITORY_SECTIONS = new Set(['AK', 'PAC', 'PR', 'VI']);

const normalizeCountyName = (value = '') =>
  String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+(County|Parish|Borough|Municipality|Census Area)$/i, '')
    .toLowerCase();

export function getContactedSections(contacts) {
  const sections = new Set();
  (contacts || []).forEach((contact) => {
    if (contact.deleted === 'Y') return;
    if (contact.locationReceived) {
      sections.add(String(contact.locationReceived).trim().toUpperCase());
    }
  });
  return sections;
}

export function mergeFeaturesToMultiPolygon(features) {
  const coordinates = [];

  features.forEach((countyFeature) => {
    if (!countyFeature?.geometry) return;
    if (countyFeature.geometry.type === 'Polygon') {
      coordinates.push(countyFeature.geometry.coordinates);
    } else if (countyFeature.geometry.type === 'MultiPolygon') {
      countyFeature.geometry.coordinates.forEach((polygon) => coordinates.push(polygon));
    }
  });

  return {
    type: 'MultiPolygon',
    coordinates
  };
}

function transformGeometry(geometry, scaleX, scaleY, centerOffset, newCenter) {
  const transformCoord = (coord) => [
    (coord[0] - centerOffset[0]) * scaleX + newCenter[0],
    (coord[1] - centerOffset[1]) * scaleY + newCenter[1]
  ];

  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring) => ring.map(transformCoord))
    };
  }

  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) => ring.map(transformCoord))
      )
    };
  }

  return geometry;
}

function transformTerritoryGeometry(geometry, section) {
  if (section === 'AK') {
    return transformGeometry(geometry, 0.3, 0.35, [-150, 65], [-125, 28]);
  }
  if (section === 'PAC') {
    return transformGeometry(geometry, 0.4, 0.4, [-160, 20], [-115, 25]);
  }
  if (section === 'PR') {
    return transformGeometry(geometry, 0.45, 0.45, [-66, 18], [-70, 20]);
  }
  if (section === 'VI') {
    return transformGeometry(geometry, 0.4, 0.4, [-64, 18], [-68, 20]);
  }
  return geometry;
}

export function buildCountySectionMapData(countiesGeoJson) {
  if (!countiesGeoJson?.features?.length) {
    return null;
  }

  const countyFeatures = [];
  const sectionCountyGroups = new Map();

  countiesGeoJson.features.forEach((county) => {
    const state = county.properties?.STUSPS;
    const section = getSectionForCounty(state, county.properties?.NAME);
    if (!section) return;

    const geometry = TERRITORY_SECTIONS.has(section)
      ? transformTerritoryGeometry(county.geometry, section)
      : county.geometry;

    countyFeatures.push({
      type: 'Feature',
      properties: {
        section,
        name: ARRL_SECTION_NAMES[section] || section,
        isTerritory: TERRITORY_SECTIONS.has(section)
      },
      geometry
    });

    if (!sectionCountyGroups.has(section)) {
      sectionCountyGroups.set(section, []);
    }
    sectionCountyGroups.get(section).push({ type: 'Feature', geometry });
  });

  const sectionLabels = Array.from(sectionCountyGroups.entries()).map(([section, features]) => ({
    section,
    feature: {
      type: 'Feature',
      properties: { section },
      geometry: mergeFeaturesToMultiPolygon(features)
    }
  }));

  return {
    counties: {
      type: 'FeatureCollection',
      features: countyFeatures
    },
    sectionLabels
  };
}

export function normalizeCountyKey(stusps, countyName) {
  return `${String(stusps || '').toUpperCase()}|${normalizeCountyName(countyName)}`;
}
