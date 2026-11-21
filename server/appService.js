import { CONFIG } from './config.js';
import { geocodeTown, weatherFor, facilitiesNear, pigInventory, harvestProgress } from './providers.js';
import { validIowaCoordinate } from './geo.js';
import { buildTodayForecast } from './model.js';
import { seasonForDate } from './season.js';

/** An injectable application service; other JS files may call it with their own provider functions. */
export async function getOdorDashboard(input, deps = {}) {
  const geocode = deps.geocode || geocodeTown;
  const getWeather = deps.weather || weatherFor;
  const getFacilities = deps.facilities || facilitiesNear;
  const getCropProgress = deps.cropProgress || harvestProgress;
  const now = deps.now ?? Date.now();

  const manureStatus = input.manureStatus || 'unknown';
  if (!['yes', 'no', 'unknown'].includes(manureStatus)) throw new Error('Manure status must be yes, no or unknown.');
  let receptor;
  if (typeof input.town === 'string' && input.town.trim()) {
    if (input.town.length > 100) throw new Error('Town name is too long.');
    receptor = await geocode(input.town.trim());
  } else {
    const lat = Number(input.lat), lon = Number(input.lon);
    if (!validIowaCoordinate(lat, lon)) throw new Error('Choose an Iowa city or share a location in Iowa.');
    receptor = { lat, lon, label: 'Your approximate Iowa location', source: 'Browser geolocation' };
  }
  const { lat, lon } = receptor;
  // Live weather and DNR coordinates are both required for a meaningful score.
  const [weather, dnr, cropProgress] = await Promise.all([
    getWeather(lat, lon), getFacilities(lat, lon), getCropProgress({ year: new Date(now).getUTCFullYear() })
  ]);
  const prediction = buildTodayForecast({ receptor, current: weather.current, forecasts: weather.forecasts,
    farms: dnr.facilities, manureStatus, now });
  const warnings = [
    'This is an uncalibrated risk index, not a measured odor level or a statistical probability.',
    'Mapped facilities are not confirmed to be spreading manure. Small/unregistered operations and field application sites may be missing.',
    'A 3-hour forecast cannot predict the precise minute of strongest odor.'
  ];
  if (!prediction.current.windDirectionAvailable) warnings.push('OpenWeather did not return a wind direction; a neutral directional assumption was used.');
  if (!dnr.complete) warnings.push('The facility lookup reached a result cap; nearby facility coverage is incomplete.');
  if (weather.forecastError) warnings.push(weather.forecastError);
  if (!prediction.forecastsAvailable) warnings.push('No remaining forecast samples today; peak time is unavailable.');
  if (manureStatus === 'unknown') warnings.push('No real-time manure application feed exists here; seasonal activity is only a heuristic.');

  return {
    location: { label: receptor.label, lat: +lat.toFixed(5), lon: +lon.toFixed(5), source: receptor.source },
    generatedAt: new Date(now).toISOString(), timeZone: CONFIG.timeZone,
    model: { name: 'Iowa odor exposure index', calibrated: false, type: 'heuristic', version: '1.0.0' },
    conditions: { ...weather.current, manureStatus, season: seasonForDate(now), cropProgress },
    prediction: { ...prediction, current: { ...prediction.current, topSources: prediction.current.topSources.slice(0, 8) } },
    facilities: { totalNearby: dnr.facilities.length,
      pigFacilities: dnr.facilities.filter(f => f.swineAnimalUnits > 0).length,
      searchRadiusKm: dnr.radiusKm, complete: dnr.complete, source: dnr.sourceUrl },
    sources: {
      weather: weather.sourceUrl,
      facilities: dnr.sourceUrl,
      season: 'https://www.iowadnr.gov/media/2319/download?inline=',
      crop: cropProgress?.sourceUrl || null
    }, warnings
  };
}

export async function getPigCounter(deps = {}) { return (deps.getInventory || pigInventory)(); }
