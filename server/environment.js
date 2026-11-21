/** Additional public environmental readings. Nothing here converts odor to an AQI. */
import { CONFIG } from './config.js';
import { fetchJSON } from './net.js';
import { haversineKm, searchEnvelope, validIowaCoordinate } from './geo.js';
import { weatherFor } from './providers.js';

export const AIRNOW_SOURCE = 'https://docs.airnowapi.org/webservices';
export const USGS_SOURCE = 'https://waterservices.usgs.gov/nwis/iv/';
export const IWQIS_SOURCE = 'https://iwqis.iowawis.org/';

const MEASURES = {
  '00631': { name: 'Nitrate + nitrite (as N)', preferred: true },
  '00618': { name: 'Nitrate (as N)', preferred: true },
  '00300': { name: 'Dissolved oxygen' },
  '00400': { name: 'pH' },
  '00010': { name: 'Water temperature' },
  '00060': { name: 'Stream discharge' },
  '00045': { name: 'Precipitation at gauge' }
};

export function normalizeAirNow(records) {
  const raw = Array.isArray(records) ? records : records?.data || records?.results || [];
  const readings = raw.map(row => ({
    aqi: Number(row.AQI ?? row.aqi),
    pollutant: String(row.ParameterName ?? row.parameterName ?? row.parameter ?? 'Unknown'),
    category: String(row.Category?.Name ?? row.Category?.name ?? row.category?.name ?? row.category ?? ''),
    area: String(row.ReportingArea ?? row.reportingArea ?? ''),
    date: row.DateObserved ?? row.dateObserved ?? null,
    hour: row.HourObserved ?? row.hourObserved ?? null
  })).filter(r => Number.isFinite(r.aqi) && r.aqi >= 0);
  // AirNow returns pollutant-specific NowCast values. The highest is the area's overall AQI.
  readings.sort((a, b) => b.aqi - a.aqi);
  return readings.length ? {
    available: true, aqi: readings[0].aqi,
    category: /^[1-6]$/.test(readings[0].category) || !readings[0].category ? aqiCategory(readings[0].aqi) : readings[0].category,
    dominantPollutant: readings[0].pollutant,
    reportingArea: readings[0].area,
    observedDate: readings[0].date, observedHour: readings[0].hour,
    readings, type: 'Measured reporting-area NowCast AQI (EPA AirNow)', sourceUrl: AIRNOW_SOURCE
  } : { available: false, reason: 'AirNow has no current reporting-area observation for this location.', sourceUrl: AIRNOW_SOURCE };
}

function aqiCategory(n) {
  return n <= 50 ? 'Good' : n <= 100 ? 'Moderate' : n <= 150 ? 'Unhealthy for Sensitive Groups'
    : n <= 200 ? 'Unhealthy' : n <= 300 ? 'Very Unhealthy' : 'Hazardous';
}

export async function airQualityFor(lat, lon, { key = CONFIG.airNowKey, fetcher = fetchJSON } = {}) {
  if (!key) return { available: false, reason: 'Add AIRNOW_API_KEY to .env for measured US AQI.', sourceUrl: AIRNOW_SOURCE };
  // Replacement endpoint, launched June 2026. Older /observation/latLong/current was retired.
  const url = new URL('https://www.airnowapi.org/aq/observation/current/ziplatlong/');
  for (const [k, v] of Object.entries({ format: 'application/json', latitude: lat, longitude: lon, API_KEY: key })) url.searchParams.set(k, v);
  return normalizeAirNow(await fetcher(url, { service: 'EPA AirNow', ttlMs: 30 * 60_000, timeoutMs: 13000 }));
}

function pickRecentValues(timeSeries) {
  const values = (timeSeries.values || []).flatMap(v => v.value || [])
    .filter(v => v.dateTime && v.value != null && Number.isFinite(Number(v.value)))
    .sort((a, b) => Date.parse(b.dateTime) - Date.parse(a.dateTime));
  return values[0] || null;
}

export function normalizeUSGS(data, receptor, { limit = 7, now = Date.now() } = {}) {
  const all = data?.value?.timeSeries;
  if (!Array.isArray(all)) return [];
  const sites = new Map();
  for (const series of all) {
    const site = series.sourceInfo || {};
    const lat = Number(site.geoLocation?.geogLocation?.latitude);
    const lon = Number(site.geoLocation?.geogLocation?.longitude);
    const code = String(series.variable?.variableCode?.[0]?.value || '');
    const measure = MEASURES[code];
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !measure) continue;
    const reading = pickRecentValues(series);
    if (!reading || !Number.isFinite(Date.parse(reading.dateTime))) continue;
    if (Date.parse(reading.dateTime) > now + 3600_000 || now - Date.parse(reading.dateTime) > 7 * 86400_000) continue;
    if (!validIowaCoordinate(lat, lon)) continue;
    const siteId = String(site.siteCode?.[0]?.value || `${lat},${lon}`);
    const entry = sites.get(siteId) || {
      id: siteId, name: site.siteName || 'USGS stream monitoring site', lat, lon,
      distanceKm: Math.round(haversineKm(receptor, { lat, lon }) * 10) / 10, readings: []
    };
    const value = Number(reading.value);
    const units = series.variable?.unit?.unitCode || '';
    if (!entry.readings.some(r => r.code === code)) entry.readings.push({
      code, label: measure.name, value, units, measuredAt: reading.dateTime,
      parameter: series.variable?.variableName || measure.name
    });
    sites.set(siteId, entry);
  }
  // Prioritize sites with nitrate / oxygen readings, then proximity.
  return [...sites.values()].sort((a, b) => {
    const relevant = x => x.readings.filter(r => ['00631','00618','00300'].includes(r.code)).length;
    return relevant(b) - relevant(a) || a.distanceKm - b.distanceKm;
  }).slice(0, limit);
}

export async function waterQualityFor(lat, lon, { fetcher = fetchJSON, radiusKm = 60, now = Date.now() } = {}) {
  const bounds = searchEnvelope(lat, lon, radiusKm);
  const url = new URL(USGS_SOURCE);
  for (const [k, v] of Object.entries({
    format: 'json', bBox: [bounds.xmin,bounds.ymin,bounds.xmax,bounds.ymax].map(x => x.toFixed(5)).join(','),
    parameterCd: Object.keys(MEASURES).join(','), siteType: 'ST', period: 'P7D', siteStatus: 'all'
  })) url.searchParams.set(k, v);
  const data = await fetcher(url, { service: 'USGS stream monitoring', ttlMs: 45 * 60_000, timeoutMs: 15000 });
  const stations = normalizeUSGS(data, { lat, lon }, { now });
  return {
    available: stations.length > 0, stations,
    missingNote: 'Not every stream has nitrate or dissolved-oxygen sensors. A missing reading is not zero.',
    sourceUrl: USGS_SOURCE, otherIowaSource: IWQIS_SOURCE, radiusKm,
    method: 'USGS instantaneous readings reported during the last 7 days; not an assessment of drinking-water safety.'
  };
}

export function rainfallContext(weather, now = Date.now()) {
  const currentRainMm = Number(weather?.current?.rain1hMm || 0);
  const upcoming = (weather?.forecasts || []).filter(f => f.timestampMs > now && f.timestampMs <= now + 86400_000);
  const forecastNext24hMm = upcoming.reduce((sum, f) => sum + (Number(f.rain3hMm) || 0), 0);
  const total = Math.round(forecastNext24hMm * 10) / 10;
  let level = 'Low rainfall forecast';
  if (total >= 25) level = 'Substantial rainfall forecast';
  else if (total >= 10) level = 'Rain possible';
  return {
    observedLastHourMm: Math.round(currentRainMm * 10) / 10,
    forecastNext24hMm: total, forecastHoursAvailable: upcoming.length * 3,
    label: level, sourceUrl: 'https://openweathermap.org/forecast5',
    explanation: total >= 10
      ? 'Rain can mobilize nutrients from fields, especially if manure was applied recently or soil is saturated. A forecast alone cannot establish that runoff or contamination occurred.'
      : 'Limited forecast rainfall may reduce immediate rain-driven runoff opportunity, but soil, slopes, field practices and earlier rainfall still matter.',
    warning: 'This is a weather-based educational flag, NOT a water contamination prediction.'
  };
}

/** Data-independent and testable. Failures of independent providers never replace readings with fake values. */
export async function getEnvironmentDashboard({ lat, lon }, deps = {}) {
  const latitude = Number(lat), longitude = Number(lon);
  if (!validIowaCoordinate(latitude, longitude)) throw new Error('Choose an Iowa location to view environment readings.');
  const now = deps.now ?? Date.now();
  const [air, water, weather] = await Promise.allSettled([
    (deps.air || airQualityFor)(latitude, longitude),
    (deps.water || waterQualityFor)(latitude, longitude),
    (deps.weather || weatherFor)(latitude, longitude)
  ]);
  const warning = (out, service) => out.status === 'rejected' ? `${service} could not be loaded; no values were inferred.` : null;
  return {
    location: { lat: latitude, lon: longitude }, updatedAt: new Date(now).toISOString(),
    air: air.status === 'fulfilled' ? air.value : { available: false, reason: 'AirNow is temporarily unavailable.', sourceUrl: AIRNOW_SOURCE },
    water: water.status === 'fulfilled' ? water.value : { available: false, stations: [], sourceUrl: USGS_SOURCE, otherIowaSource: IWQIS_SOURCE },
    rainfall: weather.status === 'fulfilled' ? rainfallContext(weather.value, now) : null,
    warnings: [warning(air, 'AirNow'), warning(water, 'USGS'), warning(weather, 'Rainfall')].filter(Boolean)
  };
}
