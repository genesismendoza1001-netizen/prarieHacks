import { CONFIG } from './config.js';
import { fetchJSON, ProviderError } from './net.js';
import { clamp, haversineKm, searchEnvelope, validIowaCoordinate } from './geo.js';

const ALL_SWINE_FIELDS = ['Swine_Gest', 'Swine_Gilt', 'Swine_Grow', 'Swine_Nurs', 'Swine_Sow', 'Swine_Wean'];
const DNR_FIELDS = ['FID', 'FacilityID', 'FacilityNa', 'Latitude', 'Longitude', 'TotalAnima', 'OpeartionT', ...ALL_SWINE_FIELDS];

export async function geocodeTown(town, { googleKey = CONFIG.googleServerKey, fetcher = fetchJSON } = {}) {
  if (!googleKey) throw new ProviderError('Google Maps', 'Set GOOGLE_MAPS_SERVER_KEY in .env to search cities.', 503);
  if (!town || typeof town !== 'string' || town.length > 100) throw new Error('Enter a city or town in Iowa.');
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', `${town}, Iowa, USA`);
  url.searchParams.set('components', 'administrative_area:IA|country:US');
  url.searchParams.set('key', googleKey);
  const data = await fetcher(url, { service: 'Google Maps', ttlMs: 86400_000 });
  if (data.status === 'ZERO_RESULTS' || !data.results?.length) throw new Error(`No Iowa town found for "${town}".`);
  if (data.status !== 'OK') throw new ProviderError('Google Maps', `Google geocoding failed (${data.status}).`);
  const candidate = data.results.find(r =>
    r.address_components?.some(c => c.short_name === 'IA' && c.types?.includes('administrative_area_level_1'))
    && r.address_components?.some(c => c.short_name === 'US' && c.types?.includes('country'))
  );
  if (!candidate) throw new Error('Choose a location in Iowa.');
  const lat = Number(candidate.geometry?.location?.lat), lon = Number(candidate.geometry?.location?.lng);
  if (!validIowaCoordinate(lat, lon)) throw new Error('The selected location is outside the supported Iowa area.');
  return { lat, lon, label: candidate.formatted_address, source: 'Google Maps Geocoding API' };
}

export function normalizeWeather(point, { current = false } = {}) {
  const tempF = Number(point.main?.temp);
  const humidity = Number(point.main?.humidity);
  const windMph = point.wind?.speed == null ? NaN : Number(point.wind.speed);
  const windRaw = point.wind?.deg;
  if (![tempF, humidity, windMph].every(Number.isFinite)) {
    throw new ProviderError('OpenWeather', 'Weather data is missing temperature, humidity, or wind speed.');
  }
  return {
    tempF, humidity: clamp(humidity, 0, 100), windMph,
    windFromDeg: windRaw === undefined || windRaw === null ? null : Number(windRaw),
    description: point.weather?.[0]?.description || '',
    timestampMs: Number(point.dt) * 1000,
    isCurrent: current
  };
}

export async function weatherFor(lat, lon, { key = CONFIG.openWeatherKey, fetcher = fetchJSON } = {}) {
  if (!key) throw new ProviderError('OpenWeather', 'Set OPENWEATHER_API_KEY in .env to get live predictions.', 503);
  const makeUrl = path => {
    const url = new URL(`https://api.openweathermap.org/data/2.5/${path}`);
    url.searchParams.set('lat', lat);
    url.searchParams.set('lon', lon);
    url.searchParams.set('appid', key);
    url.searchParams.set('units', 'imperial');
    return url;
  };
  const currentData = await fetcher(makeUrl('weather'), { service: 'OpenWeather current', ttlMs: 8 * 60_000 });
  const current = normalizeWeather(currentData, { current: true });
  let forecasts = [], forecastError = null;
  try {
    const forecastData = await fetcher(makeUrl('forecast'), { service: 'OpenWeather forecast', ttlMs: 15 * 60_000 });
    forecasts = (forecastData.list || []).map(p => normalizeWeather(p));
  } catch (err) {
    forecastError = err.message;
  }
  return { current, forecasts, forecastError, sourceUrl: 'https://openweathermap.org/api/forecast5' };
}

export function normalizeDnrFeature(feature) {
  const a = feature.attributes || {};
  const geom = feature.geometry || {};
  const attrLat = a.Latitude == null ? NaN : Number(a.Latitude);
  const attrLon = a.Longitude == null ? NaN : Number(a.Longitude);
  const attributePointValid = validIowaCoordinate(attrLat, attrLon);
  const lat = attributePointValid ? attrLat : Number(geom.y);
  const lon = attributePointValid ? attrLon : Number(geom.x);
  if (!validIowaCoordinate(lat, lon)) return null;
  const swineAnimalUnits = ALL_SWINE_FIELDS.reduce((sum, field) => sum + Math.max(0, Number(a[field]) || 0), 0);
  const totalAnimalUnits = Math.max(swineAnimalUnits, Math.max(0, Number(a.TotalAnima) || 0));
  return {
    id: String(a.FacilityID ?? a.FID ?? `${lat},${lon}`),
    name: String(a.FacilityNa || 'Livestock operation').slice(0, 110),
    type: String(a.OpeartionT || 'Animal feeding operation').slice(0, 60),
    lat, lon, swineAnimalUnits, totalAnimalUnits
  };
}

export async function facilitiesNear(lat, lon, { layerUrl = CONFIG.dnrLayerUrl, radiusKm = CONFIG.searchRadiusKm, fetcher = fetchJSON } = {}) {
  const bounds = searchEnvelope(lat, lon, radiusKm);
  const facilities = [];
  const pageSize = 1500;
  const maxPages = 10;
  let complete = true;
  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${layerUrl}/query`);
    Object.entries({
      f: 'json', where: '1=1', outFields: DNR_FIELDS.join(','), returnGeometry: 'true',
      outSR: '4326', inSR: '4326', geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects', geometry: JSON.stringify(bounds),
      resultOffset: String(page * pageSize), resultRecordCount: String(pageSize),
      orderByFields: 'FID ASC'
    }).forEach(([k, v]) => url.searchParams.set(k, v));
    const data = await fetcher(url, { service: 'Iowa DNR', ttlMs: 6 * 60 * 60_000, timeoutMs: 15000 });
    if (data.error) throw new ProviderError('Iowa DNR', `Iowa DNR rejected the query (${data.error.code || 'unknown'}).`);
    if (!Array.isArray(data.features)) throw new ProviderError('Iowa DNR', 'Iowa DNR returned an unexpected feature format.');
    for (const raw of data.features) {
      const f = normalizeDnrFeature(raw);
      if (f && haversineKm({ lat, lon }, f) <= radiusKm) facilities.push(f);
    }
    if (data.features.length < pageSize && !data.exceededTransferLimit) break;
    if (page === maxPages - 1) complete = false;
  }
  // Same physical facility occasionally represented more than once; avoid double-counting IDs.
  const unique = Array.from(new Map(facilities.map(f => [f.id, f])).values());
  return { facilities: unique, complete, radiusKm, sourceUrl: layerUrl };
}

// A dated official figure, not an API response and not an estimate of "pigs alive now".
const SNAPSHOT = {
  value: 24_700_000, asOf: '2026-09-01', label: 'Iowa hog and pig inventory',
  attribution: 'USDA NASS, Quarterly Hogs and Pigs (published 2026-09-24)',
  sourceUrl: 'https://data.nass.usda.gov/Newsroom/2026/09-24-2026.php', live: false
};

function parseNassValue(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}
function referenceDate(record) {
  const year = Number(record.year);
  if (!Number.isFinite(year)) return null;
  const code = String(record.reference_period_desc || '').toUpperCase();
  const months = { MAR: 3, JUN: 6, SEP: 9, DEC: 12 };
  const month = Object.entries(months).find(([abbr]) => code.includes(abbr))?.[1];
  return month ? `${year}-${String(month).padStart(2, '0')}-01` : `${year}-01-01`;
}

export function selectLatestHogInventory(records = []) {
  const choices = records.filter(r => {
    const desc = String(r.short_desc || '').toUpperCase();
    return desc.startsWith('HOGS - INVENTORY') && String(r.domain_desc || '').toUpperCase() === 'TOTAL'
      && String(r.class_desc || '').toUpperCase() === 'ALL CLASSES'
      && r.agg_level_desc === 'STATE' && String(r.unit_desc || '').toUpperCase() === 'HEAD'
      && parseNassValue(r.Value);
  }).map(r => ({ value: parseNassValue(r.Value), asOf: referenceDate(r), raw: r })).filter(r => r.asOf);
  choices.sort((a, b) => b.asOf.localeCompare(a.asOf));
  return choices[0] || null;
}

export async function pigInventory({ key = CONFIG.nassKey, fetcher = fetchJSON } = {}) {
  if (!key) return { ...SNAPSHOT, note: 'Dated USDA inventory snapshot; configure NASS_API_KEY for data refresh.' };
  try {
    const url = new URL('https://quickstats.nass.usda.gov/api/api_GET/');
    Object.entries({ key, commodity_desc: 'HOGS', statisticcat_desc: 'INVENTORY',
      state_alpha: 'IA', agg_level_desc: 'STATE', year__GE: '2025',
      freq_desc: 'QUARTERLY', format: 'JSON' }).forEach(([k,v]) => url.searchParams.set(k,v));
    const data = await fetcher(url, { service: 'USDA NASS', ttlMs: 12 * 60 * 60_000 });
    const result = selectLatestHogInventory(data.data);
    if (result && result.asOf >= SNAPSHOT.asOf) return {
      value: result.value, asOf: result.asOf, label: SNAPSHOT.label,
      attribution: 'USDA NASS Quick Stats', sourceUrl: 'https://quickstats.nass.usda.gov/', live: true
    };
    return { ...SNAPSHOT, note: 'Quick Stats did not return a newer comparable quarterly series.' };
  } catch {
    return { ...SNAPSHOT, note: 'USDA Quick Stats could not be reached; showing the dated official snapshot.' };
  }
}

export async function harvestProgress({ key = CONFIG.nassKey, year = new Date().getUTCFullYear(), fetcher = fetchJSON } = {}) {
  if (!key) return null;
  try {
    const url = new URL('https://quickstats.nass.usda.gov/api/api_GET/');
    Object.entries({ key, commodity_desc: 'CORN', statisticcat_desc: 'PROGRESS', state_alpha: 'IA',
      agg_level_desc: 'STATE', year: String(year), format: 'JSON' }).forEach(([k,v]) => url.searchParams.set(k,v));
    const data = await fetcher(url, { service: 'USDA NASS crop progress', ttlMs: 12 * 60 * 60_000 });
    const entries = (data.data || []).filter(r =>
      String(r.short_desc || '').toUpperCase().includes('HARVESTED')
      && String(r.unit_desc || '').toUpperCase() === 'PCT'
      && String(r.domain_desc || '').toUpperCase() === 'TOTAL'
    ).map(r => ({ pct: parseNassValue(r.Value), date: r.week_ending })).filter(r =>
      r.pct !== null && r.pct <= 100 && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
    ).sort((a,b) => b.date.localeCompare(a.date));
    if (!entries.length) return null;
    return { harvestedPct: entries[0].pct, asOf: entries[0].date,
      description: 'Iowa corn acreage harvested (statewide weekly observation)',
      sourceUrl: 'https://quickstats.nass.usda.gov/' };
  } catch { return null; }
}
