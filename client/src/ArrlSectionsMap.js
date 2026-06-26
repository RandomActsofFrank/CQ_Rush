import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, GeoJSON, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { buildCountySectionMapData, getContactedSections } from './arrlMapUtils';

function SectionLabel({ feature, theme }) {
  const map = useMap();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!feature?.geometry || !map) return undefined;

    const layer = L.geoJSON(feature);
    const center = layer.getBounds().getCenter();
    const label = L.divIcon({
      className: 'section-map-label',
      html: `<div style="color:${isDark ? '#d9f99d' : '#444'};text-shadow:${isDark ? '1px 1px 2px rgba(0,0,0,0.85)' : '1px 1px 2px rgba(255,255,255,0.9)'}">${feature.properties.section}</div>`,
      iconSize: [36, 16],
      iconAnchor: [18, 8]
    });

    const marker = L.marker(center, { icon: label }).addTo(map);
    return () => {
      map.removeLayer(marker);
    };
  }, [feature, map, isDark]);

  return null;
}

function ArrlSectionsMap({
  contacts = [],
  height = 600,
  showLegend = true,
  showOpenLink = false,
  theme = 'light',
  fillHeight = false,
  embedded = false
}) {
  const [countiesGeoJson, setCountiesGeoJson] = useState(null);
  const [loadError, setLoadError] = useState('');
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/us_counties_5m.json')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load county map data.');
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setCountiesGeoJson(data);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message || 'Unable to load map data.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const mapData = useMemo(
    () => buildCountySectionMapData(countiesGeoJson),
    [countiesGeoJson]
  );

  const contactedSections = useMemo(() => getContactedSections(contacts), [contacts]);

  const contactedKey = useMemo(
    () => Array.from(contactedSections).sort().join(','),
    [contactedSections]
  );

  const isDark = theme === 'dark';
  const mapLandColor = isDark ? '#252f3f' : '#ffffff';
  const canvasRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  const style = useCallback((feature) => {
    const section = feature.properties.section;
    const isContacted = contactedSections.has(section);

    if (isContacted) {
      return {
        fillColor: '#558303',
        stroke: false,
        fillOpacity: isDark ? 0.92 : 0.88
      };
    }

    return {
      fillColor: mapLandColor,
      stroke: false,
      fillOpacity: 1
    };
  }, [contactedSections, isDark, mapLandColor]);

  if (loadError) {
    return <div className="sections-map-loading">{loadError}</div>;
  }

  if (!mapData) {
    return <div className="sections-map-loading">Loading ARRL section map...</div>;
  }

  return (
    <div className={`sections-map-content ${isDark ? 'sections-map-dark' : 'sections-map-light'}${embedded ? ' sections-map-embedded' : ''}`}>
      {showLegend && (
        <div className="sections-map-toolbar">
          <div className="sections-map-legend">
            <span className="legend-item legend-contacted">Contacted section</span>
            <span className="legend-item legend-uncontacted">Not yet contacted</span>
            <span className="legend-count">{contactedSections.size} sections worked</span>
          </div>
          {showOpenLink && (
            <a
              href="/display"
              target="_blank"
              rel="noopener noreferrer"
              className="sections-map-open-link"
            >
              Open in Separate Tab ↗
            </a>
          )}
        </div>
      )}
      <div className={`arrl-map-container${fillHeight ? ' arrl-map-fill' : ''}`}>
        <MapContainer
          center={[39.8283, -98.5795]}
          zoom={4.25}
          style={{
            height: fillHeight ? '100%' : `${height}px`,
            width: '100%',
            minHeight: fillHeight ? 0 : undefined
          }}
          zoomControl={false}
          ref={mapRef}
          bounds={[[18, -180], [72, -50]]}
          attributionControl={false}
          zoomSnap={0.25}
          zoomDelta={0.25}
        >
          <ZoomControl position="topright" />
          <GeoJSON
            key={`${theme}-${contactedKey}`}
            data={mapData.counties}
            style={style}
            renderer={isDark ? canvasRenderer : undefined}
          />
          {mapData.sectionLabels.map(({ section, feature }) => (
            <SectionLabel
              key={`${section}-${theme}`}
              feature={feature}
              theme={theme}
            />
          ))}
        </MapContainer>
      </div>
      <p className="sections-map-credit">
        Section boundaries per{' '}
        <a href="https://www.arrl.org/section-boundaries" target="_blank" rel="noopener noreferrer">
          ARRL Section Boundaries
        </a>
      </p>
    </div>
  );
}

export default ArrlSectionsMap;
