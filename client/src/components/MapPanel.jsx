import { useEffect, useRef, useState } from 'react';

let googlePromise;
function loadGoogleMaps(key) {
  if (!key) return Promise.resolve(false);
  if (window.google?.maps) return Promise.resolve(true);
  if (googlePromise) return googlePromise;
  googlePromise = new Promise((resolve) => {
    const callback = '__piggyReactGoogleMapsReady';
    const script = document.createElement('script');
    const timeout = setTimeout(() => finish(false), 12000);
    function finish(ok) {
      clearTimeout(timeout);
      delete window[callback];
      resolve(ok);
    }
    window[callback] = () => finish(true);
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${callback}`;
    script.async = true;
    script.onerror = () => finish(false);
    document.head.append(script);
  });
  return googlePromise;
}

export default function MapPanel({ apiKey, location, sources = [] }) {
  const root = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!apiKey) return;
    loadGoogleMaps(apiKey).then(ok => {
      if (!active) return;
      setEnabled(ok);
      setFailed(!ok);
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
    markers.current.forEach(marker => marker.setMap(null));
    markers.current = [new maps.Marker({
      map: map.current, position: center, title: 'Your forecast location',
      icon: { path: maps.SymbolPath.CIRCLE, scale: 11, fillColor: '#dc6096', fillOpacity: 1,
        strokeColor: '#fff', strokeWeight: 3 }
    })];
    for (const source of sources.slice(0, 8)) {
      markers.current.push(new maps.Marker({
        map: map.current, position: { lat: source.lat, lng: source.lon },
        title: `${source.name} (${source.distanceKm} km)`,
        icon: { path: maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#a96b72', fillOpacity: .9,
          strokeColor: '#fff', strokeWeight: 1.5 }
      }));
    }
  }, [enabled, location, sources]);

  return <div className="map-stage" aria-label="Map of nearby livestock facilities">
    <div ref={root} style={{ display: enabled && location ? 'block' : 'none', height: '100%', width: '100%' }} />
    {(!enabled || !location) && <div className="map-placeholder">
      <div className="radar r1"/><div className="radar r2"/><div className="radar r3"/>
      <span>🐽</span>
      <small>{failed ? 'Google Maps could not load; check browser API key and referrer restrictions.' :
        !apiKey ? 'Add GOOGLE_MAPS_BROWSER_KEY to .env to show the interactive map.' :
        'Search an Iowa town to display the map.'}</small>
    </div>}
  </div>;
}
