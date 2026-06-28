#!/usr/bin/env node
/**
 * Build GeoJSON for Canadian ARRL/RAC Field Day sections from n1kdo/n1mm_view shapes.
 * Source: https://github.com/n1kdo/n1mm_view/tree/master/shapes
 *
 * Usage: node scripts/build-canada-section-geojson.js
 * Requires: npm install shapefile proj4 (dev dependencies)
 */

const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const proj4 = require('proj4');

const BASE_URL = 'https://raw.githubusercontent.com/n1kdo/n1mm_view/master/shapes';
const OUTPUT_PATHS = [
  path.join(__dirname, '../client/public/arrl_canada_sections.json'),
  path.join(__dirname, '../data/geographic/arrl_canada_sections.json')
];
const CACHE_DIR = path.join(__dirname, '.tmp-shapes');

// Sections validated in fieldDayRules.js / App.js location exchange.
const CANADA_SECTION_SOURCES = {
  AB: ['AB'],
  BC: ['BC'],
  GH: ['GH'],
  MB: ['MB'],
  NB: ['NB'],
  NL: ['NL'],
  NS: ['NS'],
  ONE: ['ONE'],
  ONN: ['ONN'],
  ONS: ['ONS'],
  PE: ['PE'],
  QC: ['QC'],
  SK: ['SK'],
  TER: ['TER', 'NT'],
  YT: ['YT']
};

async function downloadShapeParts(section) {
  const sectionDir = path.join(CACHE_DIR, section);
  fs.mkdirSync(sectionDir, { recursive: true });

  for (const ext of ['shp', 'shx', 'dbf', 'prj']) {
    const filePath = path.join(sectionDir, `${section}.${ext}`);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
      continue;
    }

    const response = await fetch(`${BASE_URL}/${section}.${ext}`);
    if (!response.ok) {
      throw new Error(`Unable to download ${section}.${ext}: HTTP ${response.status}`);
    }

    fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
  }

  return path.join(sectionDir, `${section}.shp`);
}

function isProjectedCoordinate(coord) {
  const [x, y] = coord;
  return Math.abs(x) > 180 || Math.abs(y) > 90;
}

function geometryUsesProjectedCoordinates(geometry) {
  if (!geometry?.coordinates) {
    return false;
  }

  let projected = false;
  const walk = (coords) => {
    if (typeof coords[0] === 'number') {
      if (isProjectedCoordinate(coords)) {
        projected = true;
      }
      return;
    }
    coords.forEach(walk);
  };

  walk(geometry.coordinates);
  return projected;
}

function mapGeometryCoordinates(geometry, mapCoord) {
  if (!geometry) {
    return geometry;
  }

  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring) => ring.map(mapCoord))
    };
  }

  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) => ring.map(mapCoord))
      )
    };
  }

  return geometry;
}

function reprojectGeometryToWgs84(geometry, prjPath) {
  if (!geometryUsesProjectedCoordinates(geometry)) {
    return geometry;
  }

  if (!fs.existsSync(prjPath)) {
    throw new Error(`Projected coordinates require a .prj file: ${prjPath}`);
  }

  const sourceCrs = proj4(fs.readFileSync(prjPath, 'utf8'));
  const mapCoord = ([x, y]) => {
    const [lon, lat] = proj4(sourceCrs, 'WGS84', [x, y]);
    return [lon, lat];
  };

  return mapGeometryCoordinates(geometry, mapCoord);
}

async function readShapeFeature(shpPath) {
  const source = await shapefile.open(shpPath);
  const prjPath = shpPath.replace(/\.shp$/i, '.prj');
  const features = [];

  for (;;) {
    const result = await source.read();
    if (result.done) break;
    features.push({
      ...result.value,
      geometry: reprojectGeometryToWgs84(result.value.geometry, prjPath)
    });
  }

  return features;
}

function appendGeometryCoordinates(target, geometry) {
  if (!geometry) return;

  if (geometry.type === 'Polygon') {
    target.push(geometry.coordinates);
    return;
  }

  if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon) => target.push(polygon));
  }
}

function mergeGeometries(geometries) {
  const coordinates = [];
  geometries.forEach((geometry) => appendGeometryCoordinates(coordinates, geometry));

  if (!coordinates.length) {
    return null;
  }

  return {
    type: 'MultiPolygon',
    coordinates
  };
}

async function buildSectionFeature(section, sourceSections) {
  const geometries = [];

  for (const sourceSection of sourceSections) {
    const shpPath = await downloadShapeParts(sourceSection);
    const features = await readShapeFeature(shpPath);
    features.forEach((feature) => geometries.push(feature.geometry));
  }

  const geometry = mergeGeometries(geometries);
  if (!geometry) {
    throw new Error(`No geometry produced for section ${section}`);
  }

  return {
    type: 'Feature',
    properties: { section },
    geometry
  };
}

async function main() {
  const features = [];

  for (const [section, sourceSections] of Object.entries(CANADA_SECTION_SOURCES)) {
    process.stdout.write(`Building ${section}... `);
    features.push(await buildSectionFeature(section, sourceSections));
    process.stdout.write('done\n');
  }

  const collection = {
    type: 'FeatureCollection',
    features
  };

  OUTPUT_PATHS.forEach((outputPath) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(collection)}\n`);
    console.log(`Wrote ${outputPath}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
