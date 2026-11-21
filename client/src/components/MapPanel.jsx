import { useEffect, useRef, useState } from 'react';

let googlePromise;
function loadGoogleMaps(key) {
  if (!key) return Promise.resolve(false);
  if (window.google?.maps?.Map) return Promise.resolve(true);
  if (googlePromise) return googlePromise;
  googlePromise = new Promise(resolve => {
    const callback = '__piggyGoogleReady';
    const script = document.createElement('script');
    const timeout = setTimeout(() => finish(false), 14000);
    function finish(ok) {
      clearTimeout(timeout);
      delete window[callback];
      resolve(ok);
      if (!ok) googlePromise = null;
    }
    window[callback] = () => finish(true);
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${callback}`;
    script.async = true;
    script.onerror = () => finish(false);
    document.head.append(script);
  });
  return googlePromise;
}

// Geographic endpoint a distance and bearing away from the user's position.
function destination(lat, lon, bearingDeg, distanceKm) {
  const r = Math.PI / 180;
  const a = distanceKm / 6371.0088;
  const lat1 = lat * r, lon1 = lon * r, brng = bearingDeg * r;
  const latitude = Math.asin(Math.sin(lat1) * Math.cos(a) + Math.cos(lat1) * Math.sin(a) * Math.cos(brng));
  const longitude = lon1 + Math.atan2(Math.sin(brng) * Math.sin(a) * Math.cos(lat1), Math.cos(a) - Math.sin(lat1) * Math.sin(latitude));
  return { lat: latitude / r, lng: longitude / r };
}

export function windLabel(windFromDeg) {
  if (!Number.isFinite(windFromDeg)) return 'Wind direction unavailable';
  const cardinal = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const origin = cardinal[Math.round((((windFromDeg % 360) + 360) % 360) / 45) % 8];
  const to = cardinal[Math.round(((((windFromDeg + 180) % 360) + 360) % 360) / 45) % 8];
  return `Wind from ${origin}, blowing toward ${to}`;
}

export default function MapPanel({ apiKey, location, sources = [], windFromDeg, windMph }) {
  const root = useRef(null);
  const map = useRef(null);
  const overlays = useRef([]);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [plumes, setPlumes] = useState(true);

  useEffect(() => {
    let active = true;
    if (!apiKey) return;
    loadGoogleMaps(apiKey).then(ok => {
      if (!active) return;
      setEnabled(ok); setFailed(!ok);
    });
    return () => { active = false; };
  }, [apiKey]);

  useEffect(() => {
    if (!enabled || !root.current || !location || !window.google?.maps) return;
    const maps = window.google.maps;
    const center = { lat: location.lat, lng: location.lon };
    if (!map.current) {
      map.current = new maps.Map(root.current, {
        center, zoom: 10, disableDefaultUI: true, zoomControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'landscape', stylers: [{ color: '#fff1f5' }] },
          { featureType: 'water', stylers: [{ color: '#cfe8ed' }] }
        ]
      });
    } else { map.current.setCenter(center); map.current.setZoom(10); }
    overlays.current.forEach(item => item.setMap(null));
    overlays.current = [];
    const add = item => overlays.current.push(item);
    add(new maps.Marker({ map: map.current, position: center, title: 'Forecast location',
      icon: { path: maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#dd4186', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 }
    }));

    for (const source of sources.slice(0, 80)) {
      const point = { lat: source.lat, lng: source.lon };
      const pig = source.swineAnimalUnits > 0;
      if (plumes && Number.isFinite(windFromDeg)) {
        // Illustrative source-area circles, NOT modeled gas plumes or measured concentrations.
        add(new maps.Circle({ map: map.current, center: point,
          radius: Math.min(1800, 450 + Math.sqrt(Math.max(source.totalAnimalUnits || 0, 0)) * 19),
          strokeOpacity: 0, fillColor: pig ? '#e991b1' : '#d8b69b', fillOpacity: 0.10,
          clickable: false }));
      }
      add(new maps.Marker({ map: map.current, position: point,
        title: `${source.name} · ${source.distanceKm} km · ${pig ? 'Swine-containing facility' : 'Other livestock facility'}`,
        icon: { path: maps.SymbolPath.CIRCLE, scale: pig ? 6 : 5, fillColor: pig ? '#c75b8a' : '#9f8f77',
          fillOpacity: 0.92, strokeColor: '#fff', strokeWeight: 1.5 }
      }));
    }
    if (Number.isFinite(windFromDeg)) {
      const endpoint = destination(location.lat, location.lon, (windFromDeg + 180) % 360, 8);
      add(new maps.Polyline({ map: map.current, path: [center, endpoint], strokeColor: '#4178bb',
        strokeOpacity: 0.9, strokeWeight: 4, icons: [{ icon: {
          path: maps.SymbolPath.FORWARD_CLOSED_ARROW, strokeColor: '#4178bb', fillColor: '#4178bb',
          fillOpacity: 1, scale: 5 }, offset: '100%' }] }));
    }
    return () => { overlays.current.forEach(item => item.setMap(null)); overlays.current = []; };
  }, [enabled, location?.lat, location?.lon, sources, windFromDeg, plumes]);

  return <>
    <div className="map-controls">
      <span>↗ {windLabel(windFromDeg)}{Number.isFinite(windMph) ? ` · ${windMph.toFixed(1)} mph` : ''}</span>
      <label><input type="checkbox" checked={plumes} onChange={e => setPlumes(e.target.checked)}/> Show illustrative source areas</label>
    </div>
    <div className="map-stage" aria-label="Live Iowa DNR facility map and weather wind direction">
      <div ref={root} style={{ display: enabled && location ? 'block' : 'none', height: '100%', width: '100%' }} />
      {(!enabled || !location) && <div className="map-placeholder">
        <div className="radar r1"/><div className="radar r2"/><div className="radar r3"/>
        <span>🐽</span>
        <small>{failed ? 'Google Maps failed to load. Verify API activation, browser key, and localhost referrer.' :
          !apiKey ? 'Configure GOOGLE_MAPS_BROWSER_KEY to activate the live map.' :
            'Search a location to show the facilities and wind arrow.'}</small>
      </div>}
    </div>
    <div className="map-legend"><span><i className="legend-dot center"/> You</span><span><i className="legend-dot pig"/> Swine</span><span><i className="legend-dot other"/> Other livestock</span><span>↗ Blue = wind blowing toward</span></div>
    <p className="fineprint">Facility points: Iowa DNR regulated AFO records; position is approximate. Pink circles are illustrative, NOT measured odor plumes. Wind arrow uses OpenWeather's current wind-from direction. A facility is not proof of active spreading or pollution.</p>
  </>;
}
