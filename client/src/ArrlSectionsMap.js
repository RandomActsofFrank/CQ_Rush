import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, GeoJSON, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { buildSectionMapData, getContactedSections, getMapFitBounds, MAP_FOCUS_CENTER, MAP_MAX_BOUNDS } from './arrlMapUtils';

const MAP_FIT_PADDING = [8, 8];

function FitMapBounds({ bounds, padding = MAP_FIT_PADDING, respectUserView = false }) {
  const map = useMap();
  const userViewLocked = useRef(false);
  const lastSize = useRef({ width: 0, height: 0 });

  const fit = useCallback((force = false) => {
    if (!bounds) return;
    if (respectUserView && userViewLocked.current && !force) {
      map.invalidateSize();
      return;
    }

    map.invalidateSize();
    map.fitBounds(
      [bounds.southWest, bounds.northEast],
      { padding, animate: false }
    );
  }, [map, bounds, padding, respectUserView]);

  useEffect(() => {
    if (!respectUserView) {
      return undefined;
    }

    const lockView = () => {
      userViewLocked.current = true;
    };

    map.on('zoomstart', lockView);
    map.on('dragstart', lockView);
    return () => {
      map.off('zoomstart', lockView);
      map.off('dragstart', lockView);
    };
  }, [map, respectUserView]);

  useEffect(() => {
    fit(true);
    const retryTimers = [100, 400].map((delay) => setTimeout(() => fit(true), delay));
    return () => retryTimers.forEach(clearTimeout);
  }, [fit]);

  useEffect(() => {
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      const prev = lastSize.current;
      if (width === prev.width && height === prev.height) {
        return;
      }
      lastSize.current = { width, height };
      fit();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map, fit]);

  return null;
}

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
  const [canadaGeoJson, setCanadaGeoJson] = useState(null);
  const [loadError, setLoadError] = useState('');
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch('/us_counties_5m.json').then((response) => {
        if (!response.ok) throw new Error('Unable to load county map data.');
        return response.json();
      }),
      fetch('/arrl_canada_sections.json').then((response) => {
        if (!response.ok) throw new Error('Unable to load Canadian section map data.');
        return response.json();
      })
    ])
      .then(([counties, canada]) => {
        if (!cancelled) {
          setCountiesGeoJson(counties);
          setCanadaGeoJson(canada);
        }
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message || 'Unable to load map data.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const mapData = useMemo(
    () => buildSectionMapData(countiesGeoJson, canadaGeoJson),
    [countiesGeoJson, canadaGeoJson]
  );

  const contactedSections = useMemo(() => getContactedSections(contacts), [contacts]);

  const contactedKey = useMemo(
    () => Array.from(contactedSections).sort().join(','),
    [contactedSections]
  );

  const isDark = theme === 'dark';
  const mapLandColor = isDark ? '#3a4558' : '#ffffff';
  const canvasRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  const fitBounds = useMemo(() => getMapFitBounds({ embedded }), [embedded]);

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
          center={MAP_FOCUS_CENTER}
          zoom={4.5}
          style={{
            height: fillHeight ? '100%' : `${height}px`,
            width: '100%',
            minHeight: fillHeight ? 0 : undefined
          }}
          zoomControl={false}
          ref={mapRef}
          maxBounds={[
            [MAP_MAX_BOUNDS.southWest[0], MAP_MAX_BOUNDS.southWest[1]],
            [MAP_MAX_BOUNDS.northEast[0], MAP_MAX_BOUNDS.northEast[1]]
          ]}
          maxBoundsViscosity={1}
          minZoom={3}
          maxZoom={7}
          attributionControl={false}
          zoomSnap={0.25}
          zoomDelta={0.25}
        >
          <FitMapBounds
            bounds={fitBounds}
            padding={MAP_FIT_PADDING}
            respectUserView={embedded}
          />
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
    </div>
  );
}

export default ArrlSectionsMap;
