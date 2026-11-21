import { bearingDegrees, clamp, deltaDegrees, haversineKm, normalizeDegrees } from './geo.js';
import { iowaTime, seasonForDate } from './season.js';

const BANDS = [
  [20, 'Low', 'Minimal modeled risk from mapped sources'],
  [40, 'Mild', 'Some odor may be noticeable'],
  [60, 'Moderate', 'Odors may be noticeable outside'],
  [80, 'Elevated', 'Conditions favor noticeable odors'],
  [101, 'High', 'Conditions favor stronger odors']
];
export const bandFor = value => BANDS.find(([max]) => value < max)?.slice(1) || BANDS.at(-1).slice(1);

/**
 * Heuristic, uncalibrated odor-exposure index (0..100), NOT P(odor).
 * Requires a receptor, weather observation and real DNR farm locations.
 * All coefficients are explicit here and must be fitted to real odor ratings
 * before the result can be called a statistically calibrated probability.
 */
export function estimateOdor({ receptor, weather, farms, manureStatus = 'unknown', timestamp = Date.now() }) {
  if (!receptor || !Number.isFinite(receptor.lat) || !Number.isFinite(receptor.lon)) throw new Error('Valid receptor required');
  if (!weather || !Number.isFinite(weather.windMph) || !Number.isFinite(weather.tempF) || !Number.isFinite(weather.humidity)) {
    throw new Error('Temperature, humidity, and wind speed are required');
  }
  if (!Array.isArray(farms)) throw new Error('Farms must be an array from the DNR lookup');
  if (!['yes', 'no', 'unknown'].includes(manureStatus)) throw new Error('Invalid manure application status');
  const season = seasonForDate(timestamp);
  const windKnown = Number.isFinite(weather.windFromDeg);
  const windTo = windKnown ? normalizeDegrees(weather.windFromDeg + 180) : null;
  // Calm wind is more stagnant, but the directional reading is less meaningful.
  const calm = weather.windMph < 2;
  const activity = manureStatus === 'yes' ? 1.65 : manureStatus === 'no' ? 0.7 : 0.7 + season.manureOpportunity * 0.55;
  const windDilution = clamp(1.45 / (1 + 0.075 * weather.windMph), 0.52, 1.5);

  const sources = farms.map(farm => {
    const distanceKm = haversineKm(receptor, farm);
    const sourceToPerson = bearingDegrees(farm, receptor);
    const offAxis = windKnown ? deltaDegrees(windTo, sourceToPerson) : null;
    const directionalWeight = windKnown
      ? (calm ? 0.38 : Math.pow(Math.max(0, Math.cos(offAxis * Math.PI / 180)), 2))
      : 0.25;
    const swineUnits = Math.max(0, Number(farm.swineAnimalUnits) || 0);
    const otherUnits = Math.max(0, Number(farm.totalAnimalUnits) || 0) - swineUnits;
    // Animal units are NOT animal head counts. This term simply scales relative source potential.
    const animalUnitWeight = clamp(Math.log1p(swineUnits + 0.45 * Math.max(0, otherUnits)) / Math.log1p(1800), 0, 1.5);
    const distanceWeight = 1 / (1 + Math.pow(distanceKm / 4.5, 1.6));
    const contribution = directionalWeight * animalUnitWeight * distanceWeight * windDilution * activity;
    return {
      id: farm.id, name: farm.name, type: farm.type || 'Livestock facility',
      lat: farm.lat, lon: farm.lon, distanceKm: +distanceKm.toFixed(2),
      totalAnimalUnits: farm.totalAnimalUnits, swineAnimalUnits: swineUnits,
      downwindAlignment: +directionalWeight.toFixed(2),
      contribution: +contribution.toFixed(4)
    };
  }).filter(f => f.distanceKm <= 30).sort((a, b) => b.contribution - a.contribution);

  const totalExposure = sources.reduce((a, f) => a + f.contribution, 0);
  const sourcePressure = 1 - Math.exp(-totalExposure / 2.4);
  const local = iowaTime(timestamp);
  const nighttime = local.hour < 8 || local.hour >= 19;
  const calmNightProxy = nighttime && weather.windMph < 5 ? 1 : 0;
  const warm = clamp((weather.tempF - 35) / 55, 0, 1);
  const damp = clamp((weather.humidity - 35) / 65, 0, 1);
  const frostAdjustment = weather.tempF <= 30 ? -4 * sourcePressure : 0;

  // Baseline stays low if no mapped facilities contribute; not "zero smell".
  const riskIndex = Math.round(clamp(
    7 + 69 * sourcePressure + 8 * season.manureOpportunity * sourcePressure
      + 5 * warm * sourcePressure + 4 * damp * sourcePressure
      + 7 * calmNightProxy * sourcePressure + frostAdjustment,
    0, 100
  ));
  const [band, bandDescription] = bandFor(riskIndex);
  return {
    index: riskIndex, band, bandDescription, timestamp: new Date(timestamp).toISOString(),
    sourceCount: sources.length, pigFacilityCount: sources.filter(f => f.swineAnimalUnits > 0).length,
    pressure: +sourcePressure.toFixed(3), season, windDirectionAvailable: windKnown,
    stabilityMethod: calmNightProxy ? 'Calm/nighttime proxy (not a measured inversion)' : 'No inversion measurement',
    manureStatus, topSources: sources.slice(0, 10)
  };
}

export function buildTodayForecast({ receptor, current, forecasts = [], farms, manureStatus = 'unknown', now = Date.now() }) {
  const currentAt = now;
  const currentPrediction = estimateOdor({ receptor, weather: current, farms, manureStatus, timestamp: currentAt });
  const todayKey = iowaTime(currentAt).dateKey;
  const futurePoints = forecasts
    .filter(f => Number.isFinite(f.timestampMs) && f.timestampMs > currentAt && iowaTime(f.timestampMs).dateKey === todayKey)
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .map(f => ({ ...estimateOdor({ receptor, weather: f, farms, manureStatus, timestamp: f.timestampMs }),
      time: new Date(f.timestampMs).toISOString(), tempF: f.tempF, windMph: f.windMph }));
  const timeline = [{ time: new Date(currentAt).toISOString(), index: currentPrediction.index, band: currentPrediction.band, isCurrent: true },
    ...futurePoints.map(p => ({ time: p.time, index: p.index, band: p.band, isCurrent: false }))];
  // Requires at least one future forecast sample; today could be too late for a peak estimate.
  const peak = futurePoints.length
    ? futurePoints.reduce((best, p) => p.index > best.index ? p : best, futurePoints[0])
    : null;
  return { current: currentPrediction, timeline, peak: peak ? {
    time: peak.time, index: peak.index, band: peak.band,
    resolution: '3-hour OpenWeather forecast sample; not an exact peak minute'
  } : null, forecastsAvailable: futurePoints.length > 0 };
}
