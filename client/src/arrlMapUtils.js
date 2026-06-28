import { getSectionForCounty, ARRL_SECTION_NAMES } from './arrlSectionBoundaries';

const TERRITORY_SECTIONS = new Set(['AK', 'PAC', 'PR', 'VI']);

export const MAP_FOCUS_CENTER = [38.57, -92.57];
export const MAP_ZOOM_IN_FACTOR = 0.9;
// ~1.19 ≈ one Leaflet zoom-out step (zoomDelta 0.25) beyond the prior 1.0 embedded frame.
export const MAP_EMBEDDED_ZOOM_FACTOR = 1.19;
// Symmetric frame around MO — MAP_VIEW_BOUNDS is asymmetric (Alaska pulls west),
// which shifts fitBounds off-center; embedded display uses equal lat/lon spans instead.
export const MAP_EMBEDDED_HALF_SPAN = {
  lat: 13,
  lon: 34
};
// Default fitBounds frame — same initial zoom/position; northern Canada sits above this edge.
export const MAP_VIEW_BOUNDS = {
  southWest: [24, -172],
  northEast: [59, -52]
};
// Wider pan limits so YT/TER and northern provinces can be reached by scrolling or zooming out.
export const MAP_MAX_BOUNDS = {
  southWest: [24, -172],
  northEast: [78, -52]
};

export function getMapFitBounds({ embedded = false } = {}) {
  const [centerLat, centerLon] = MAP_FOCUS_CENTER;
  const factor = embedded ? MAP_EMBEDDED_ZOOM_FACTOR : MAP_ZOOM_IN_FACTOR;

  if (embedded) {
    const { lat, lon } = MAP_EMBEDDED_HALF_SPAN;
    return {
      southWest: [
        centerLat - lat * factor,
        centerLon - lon * factor
      ],
      northEast: [
        centerLat + lat * factor,
        centerLon + lon * factor
      ]
    };
  }

  const { southWest, northEast } = MAP_VIEW_BOUNDS;

  return {
    southWest: [
      centerLat + (southWest[0] - centerLat) * factor,
      centerLon + (southWest[1] - centerLon) * factor
    ],
    northEast: [
      centerLat + (northEast[0] - centerLat) * factor,
      centerLon + (northEast[1] - centerLon) * factor
    ]
  };
}

// Fixed label anchors for inset territories. Centroids from merged geometry are
// unreliable when counties cross the antimeridian (Alaska) or span large areas.
const TERRITORY_LABEL_POSITIONS = {
  AK: [-127.5, 31.5],
  PAC: [-112, 26.5],
  PR: [-73.5, 26.8],
  VI: [-65.5, 26.8]
};

// Label anchors for sections whose centroid sits above the default viewport.
const CANADA_LABEL_OVERRIDES = {
  TER: [-105, 64.5],
  YT: [-135.8, 63.5],
  ONN: [-86, 52],
  NL: [-58, 53]
};

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
    return transformGeometry(geometry, 0.418, 0.462, [-150, 65], [-127.5, 31.5]);
  }
  if (section === 'PAC') {
    return transformGeometry(geometry, 1.36, 1.36, [-160, 20], [-112, 26.5]);
  }
  if (section === 'PR') {
    return transformGeometry(geometry, 3.12, 3.12, [-66, 18], [-73.5, 26.8]);
  }
  if (section === 'VI') {
    return transformGeometry(geometry, 4.32, 4.32, [-64, 18], [-65.5, 26.8]);
  }
  return geometry;
}

export function buildCountySectionMapData(countiesGeoJson) {
  if (!countiesGeoJson?.features?.length) {
    return null;
  }

  const countyFeatures = [];
  const sectionCountyGroups = new Map();
  const territoryGeometries = new Map();

  countiesGeoJson.features.forEach((county) => {
    const state = county.properties?.STUSPS;
    const section = getSectionForCounty(state, county.properties?.NAME);
    if (!section) return;

    if (TERRITORY_SECTIONS.has(section)) {
      const geometry = transformTerritoryGeometry(county.geometry, section);
      if (!territoryGeometries.has(section)) {
        territoryGeometries.set(section, []);
      }
      territoryGeometries.get(section).push({ type: 'Feature', geometry });

      if (!sectionCountyGroups.has(section)) {
        sectionCountyGroups.set(section, []);
      }
      sectionCountyGroups.get(section).push({ type: 'Feature', geometry });
      return;
    }

    countyFeatures.push({
      type: 'Feature',
      properties: {
        section,
        name: ARRL_SECTION_NAMES[section] || section,
        isTerritory: false
      },
      geometry: county.geometry
    });

    if (!sectionCountyGroups.has(section)) {
      sectionCountyGroups.set(section, []);
    }
    sectionCountyGroups.get(section).push({ type: 'Feature', geometry: county.geometry });
  });

  territoryGeometries.forEach((features, section) => {
    countyFeatures.push({
      type: 'Feature',
      properties: {
        section,
        name: ARRL_SECTION_NAMES[section] || section,
        isTerritory: true
      },
      geometry: mergeFeaturesToMultiPolygon(features)
    });
  });

  const sectionLabels = Array.from(sectionCountyGroups.entries()).map(([section, features]) => {
    const labelCoordinates = TERRITORY_LABEL_POSITIONS[section];

    return {
      section,
      feature: {
        type: 'Feature',
        properties: { section },
        geometry: labelCoordinates
          ? { type: 'Point', coordinates: labelCoordinates }
          : mergeFeaturesToMultiPolygon(features)
      }
    };
  });

  return {
    counties: {
      type: 'FeatureCollection',
      features: countyFeatures
    },
    sectionLabels
  };
}

export function appendCanadaSections(mapData, canadaGeoJson) {
  if (!mapData || !canadaGeoJson?.features?.length) {
    return mapData;
  }

  const canadaFeatures = canadaGeoJson.features.map((feature) => {
    const section = String(feature.properties?.section || '').toUpperCase();
    return {
      type: 'Feature',
      properties: {
        section,
        name: ARRL_SECTION_NAMES[section] || section,
        isCanada: true
      },
      geometry: feature.geometry
    };
  });

  const canadaLabels = canadaGeoJson.features.map((feature) => {
    const section = String(feature.properties?.section || '').toUpperCase();
    const labelCoordinates = CANADA_LABEL_OVERRIDES[section];

    return {
      section,
      feature: {
        type: 'Feature',
        properties: { section },
        geometry: labelCoordinates
          ? { type: 'Point', coordinates: labelCoordinates }
          : feature.geometry
      }
    };
  });

  return {
    counties: {
      type: 'FeatureCollection',
      features: [...mapData.counties.features, ...canadaFeatures]
    },
    sectionLabels: [...mapData.sectionLabels, ...canadaLabels]
  };
}

export function buildSectionMapData(countiesGeoJson, canadaGeoJson) {
  const usMapData = buildCountySectionMapData(countiesGeoJson);
  if (!usMapData) {
    return null;
  }

  return appendCanadaSections(usMapData, canadaGeoJson);
}

export function normalizeCountyKey(stusps, countyName) {
  return `${String(stusps || '').toUpperCase()}|${normalizeCountyName(countyName)}`;
}
