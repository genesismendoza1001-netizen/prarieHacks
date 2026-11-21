const $ = id => document.getElementById(id);
const state = { config: null, dashboard: null, facts: [], factIndex: 0, location: null, map: null, markers: [] };
const sourceLink = 'https://services3.arcgis.com/kfmqp6kwSeDnDKNY/ArcGIS/rest/services/animal_feeding_operations/FeatureServer/0';
const tz = 'America/Chicago';

function setText(id, text) { $(id).textContent = String(text); }
function number(value, digits = 0) { return Number.isFinite(value) ? value.toFixed(digits) : '—'; }
function showAlert(message, type = 'note') {
  const alert = $('appAlert');
  alert.textContent = message;
  alert.classList.remove('hidden', 'error');
  if (type === 'error') alert.classList.add('error');
}
function hideAlert() { $('appAlert').classList.add('hidden'); }
function formatTime(timestamp) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}
function formatShortTime(timestamp) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric' }).format(new Date(timestamp)).replace(' ', '');
}
function formatToday() {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
}
function compass(direction) {
  if (direction === null || !Number.isFinite(direction)) return 'unknown';
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round(direction / 45) % 8];
}
async function api(path, options) {
  const response = await fetch(path, options);
  let data;
  try { data = await response.json(); } catch { throw new Error('Server returned an invalid response.'); }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function renderDashboard(data) {
  state.dashboard = data;
  state.location = data.location;
  const risk = data.prediction.current, weather = data.conditions;
  setText('locationHeading', data.location.label);
  setText('currentSubheading', `Updated ${formatTime(data.generatedAt)} · Iowa local time · ${data.facilities.searchRadiusKm} km search radius`);
  setText('updateBadge', '● LIVE DATA + HEURISTICS');
  $('riskMeter').style.setProperty('--score', risk.index);
  $('riskMeter').setAttribute('aria-label', `Odor risk index ${risk.index} out of 100; ${risk.band}`);
  setText('riskNumber', risk.index);
  setText('riskLabel', risk.band + ' risk');
  setText('riskDescription', risk.bandDescription);
  setText('modelNote', 'Index based on weather + mapped livestock facilities. It is not a validated probability of smelling manure.');
  setText('weatherTitle', 'Weather right now');
  setText('tempValue', `${Math.round(weather.tempF)}°`);
  setText('weatherDesc', weather.description || 'Live conditions');
  setText('windValue', `${number(weather.windMph, 1)} mph ${compass(weather.windFromDeg)}`);
  setText('humidityValue', `${Math.round(weather.humidity)}%`);
  setText('farmValue', String(data.facilities.totalNearby));
  setText('swineValue', String(data.facilities.pigFacilities));
  setText('seasonTitle', weather.season.name);
  setText('seasonDescription', weather.season.note);
  setText('harvestData', weather.cropProgress
    ? `USDA NASS corn harvest: ${weather.cropProgress.harvestedPct}% statewide as of ${weather.cropProgress.asOf}. This does not confirm local manure spreading.`
    : 'Manure application is inferred from the month unless you provide a local observation; no real-time manure spreading dataset is connected.');
  renderTimeline(data.prediction.timeline);
  if (data.prediction.peak) {
    setText('peakTime', formatTime(data.prediction.peak.time));
    setText('peakCopy', `Highest modeled remaining forecast sample today: ${data.prediction.peak.band.toLowerCase()} risk (${data.prediction.peak.index}/100).`);
  } else {
    setText('peakTime', 'Not available');
    setText('peakCopy', 'Not enough remaining forecast samples today to estimate a peak.');
  }
  renderFacilities(risk.topSources);
  renderMap(data.location, risk.topSources);
  if (data.warnings.length) showAlert(data.warnings.slice(0, 2).join(' ') + (data.warnings.length > 2 ? ' See the model notes in each card.' : ''));
  else hideAlert();
}
function renderTimeline(timeline) {
  const root = $('timeline');
  root.replaceChildren();
  if (!timeline.length) {
    const msg = document.createElement('div'); msg.className = 'timeline-empty';
    msg.textContent = 'Forecast data is not available.'; root.append(msg); return;
  }
  for (const point of timeline.slice(0, 9)) {
    const column = document.createElement('div');
    column.className = 'time-col' + (point.isCurrent ? ' current' : '');
    column.setAttribute('title', `${formatTime(point.time)} · index ${point.index}/100 · ${point.band}`);
    const value = document.createElement('div'); value.className = 'percent'; value.textContent = point.index;
    const bar = document.createElement('div'); bar.className = 'bar';
    bar.style.height = `${Math.max(6, point.index * 1.02)}px`;
    const label = document.createElement('div'); label.className = 'time-label';
    label.textContent = point.isCurrent ? 'Now' : formatShortTime(point.time);
    column.append(value, bar, label); root.append(column);
  }
}
function renderFacilities(sources) {
  const root = $('sourceList'); root.replaceChildren();
  if (!sources.length) {
    const p = document.createElement('p'); p.className = 'muted';
    p.textContent = 'No DNR-listed feeding operations were found in the search radius. That does not rule out other odor sources.';
    root.append(p); return;
  }
  for (const source of sources.slice(0, 4)) {
    const row = document.createElement('div'); row.className = 'source-row';
    const details = document.createElement('div');
    const name = document.createElement('div'); name.className = 'source-name'; name.textContent = source.name;
    const note = document.createElement('div'); note.className = 'source-note';
    note.textContent = `${source.swineAnimalUnits > 0 ? 'Swine-containing operation' : 'Other livestock operation'} · ${Math.round(source.totalAnimalUnits || 0).toLocaleString()} animal units`;
    details.append(name, note);
    const distance = document.createElement('span'); distance.className = 'source-distance';
    distance.textContent = `${source.distanceKm.toFixed(1)} km`;
    row.append(details, distance); root.append(row);
  }
  const link = document.createElement('a'); link.href = sourceLink; link.target = '_blank'; link.rel = 'noreferrer';
  link.className = 'fact-link'; link.textContent = 'Browse the full DNR dataset ↗'; root.append(link);
}
let googleMapsPromise = null;
function ensureMaps() {
  if (googleMapsPromise) return googleMapsPromise;
  if (!state.config?.googleMapsBrowserKey) return Promise.resolve(false);
  googleMapsPromise = new Promise(resolve => {
    const timeout = setTimeout(() => resolve(false), 10000);
    const callback = '__piggyMapLoaded';
    window[callback] = () => { clearTimeout(timeout); resolve(true); delete window[callback]; };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(state.config.googleMapsBrowserKey)}&callback=${callback}`;
    script.async = true;
    script.onerror = () => { clearTimeout(timeout); resolve(false); };
    document.head.append(script);
  });
  return googleMapsPromise;
}
async function renderMap(location, sources) {
  const enabled = await ensureMaps();
  // A newer search may have completed while the Google Maps script was downloading.
  if (!state.location || state.location.lat !== location.lat || state.location.lon !== location.lon) return;
  if (!enabled || !window.google?.maps) return;
  const center = { lat: location.lat, lng: location.lon };
  if (!state.map) {
    $('map').replaceChildren();
    state.map = new google.maps.Map($('map'), {
      center, zoom: 10, disableDefaultUI: true, zoomControl: true,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'landscape', stylers: [{ color: '#fff1f5' }] },
        { featureType: 'water', stylers: [{ color: '#cfe8ed' }] }]
    });
  } else { state.map.setCenter(center); state.map.setZoom(10); }
  state.markers.forEach(marker => marker.setMap(null)); state.markers = [];
  state.markers.push(new google.maps.Marker({ map: state.map, position: center, title: 'Forecast location',
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 11, fillColor: '#d9538b', fillOpacity: 1,
      strokeColor: '#ffffff', strokeWeight: 3 } }));
  sources.slice(0, 8).forEach(source => state.markers.push(new google.maps.Marker({
    map: state.map, position: { lat: source.lat, lng: source.lon }, title: `${source.name} · ${source.distanceKm} km`,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#a96b72', fillOpacity: 0.9,
      strokeColor: '#ffffff', strokeWeight: 1.5 }
  })));
}
function renderFact() {
  if (!state.facts.length) return;
  const fact = state.facts[state.factIndex % state.facts.length];
  setText('factEmoji', fact.emoji);
  setText('factText', fact.text);
  $('factSource').href = fact.url;
  setText('factSource', `Source: ${fact.source} ↗`);
}
async function loadInformationalCards() {
  const [facts, pigs] = await Promise.allSettled([api('/api/facts'), api('/api/pigs')]);
  if (facts.status === 'fulfilled') {
    state.facts = facts.value.facts || []; state.factIndex = Math.floor(Math.random() * state.facts.length);
    renderFact();
  }
  if (pigs.status === 'fulfilled') {
    const pig = pigs.value;
    setText('pigNumber', pig.value >= 1e6 ? `${(pig.value / 1e6).toFixed(1)}M` : pig.value.toLocaleString());
    setText('pigDate', `(${pig.asOf})`);
    setText('pigAttribution', `${pig.attribution}${pig.live ? ' · API data' : ' · dated snapshot'}`);
    $('pigSourceLink').href = pig.sourceUrl;
  }
}
async function getPrediction(input) {
  $('searchBtn').disabled = true;
  setText('searchBtn', 'Sniffing…');
  showAlert('Checking current weather, nearby Iowa DNR facilities, and remaining forecast windows.');
  try {
    const params = new URLSearchParams({ ...input, manureStatus: $('manureSelect').value });
    const data = await api(`/api/predict?${params.toString()}`);
    renderDashboard(data);
  } catch (err) {
    showAlert(err.message || 'Unable to load a forecast.', 'error');
  } finally {
    $('searchBtn').disabled = false;
    $('searchBtn').textContent = 'Sniff it →';
  }
}
$('searchForm').addEventListener('submit', e => {
  e.preventDefault(); const town = $('townInput').value.trim();
  if (town) getPrediction({ town });
});
$('geolocateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) return showAlert('This browser does not support geolocation. Enter a town instead.', 'error');
  showAlert('Requesting browser location permission. You can choose a town instead.');
  navigator.geolocation.getCurrentPosition(position => {
    getPrediction({ lat: position.coords.latitude, lon: position.coords.longitude });
  }, error => showAlert('Location unavailable or permission declined. Enter an Iowa city to continue.', 'error'),
  { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 });
});
$('manureSelect').addEventListener('change', () => {
  if (!state.dashboard) return;
  const { source, label, lat, lon } = state.location;
  if (source === 'Google Maps Geocoding API') getPrediction({ town: $('townInput').value.trim() || label });
  else getPrediction({ lat, lon });
});
$('nextFactBtn').addEventListener('click', () => { state.factIndex++; renderFact(); });
$('observationForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.location) { setText('observationMessage', 'Get a forecast first to establish a location.'); return; }
  if (!$('consentCheck').checked) { setText('observationMessage', 'Please opt in to save a report.'); return; }
  try {
    await api('/api/observations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: state.location.lat, lon: state.location.lon, level: Number($('smellSelect').value), consent: true })
    });
    setText('observationMessage', 'Saved on this server. Thank you! This will not change the model automatically.');
    $('consentCheck').checked = false;
  } catch (err) { setText('observationMessage', err.message); }
});

async function initialize() {
  setText('clock', formatToday());
  await loadInformationalCards();
  try {
    state.config = await api('/api/config');
    if (!state.config.weatherConfigured) return showAlert('Setup needed: add OPENWEATHER_API_KEY to .env and restart the app. No simulated forecast is shown.', 'error');
    if (!state.config.townSearchEnabled) return showAlert('Town lookup needs GOOGLE_MAPS_SERVER_KEY. You can still choose “Use my current location” with an OpenWeather key.', 'error');
    await getPrediction({ town: $('townInput').value.trim() });
  } catch (err) { showAlert(`Connection issue: ${err.message}`, 'error'); }
}
initialize();
