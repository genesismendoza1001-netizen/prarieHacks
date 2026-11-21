import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateOdor, buildTodayForecast } from '../server/model.js';
import { validIowaCoordinate, bearingDegrees, haversineKm, deltaDegrees } from '../server/geo.js';
import { seasonForDate, iowaTime } from '../server/season.js';

const receptor = { lat: 41.7434, lon: -92.7247 };
const farmWest = { id: 'f1', name: 'West farm', lat: 41.7434, lon: -92.77,
  totalAnimalUnits: 1000, swineAnimalUnits: 1000 };
const farmEast = { id: 'f2', name: 'East farm', lat: 41.7434, lon: -92.68,
  totalAnimalUnits: 1000, swineAnimalUnits: 1000 };
const weather = { tempF: 55, humidity: 65, windMph: 6, windFromDeg: 270 };
const timestamp = '2026-10-21T18:00:00Z';

test('geographic helper directions and distance', () => {
  assert.equal(validIowaCoordinate(receptor.lat, receptor.lon), true);
  assert.equal(validIowaCoordinate(35, -100), false);
  assert.ok(haversineKm(receptor, farmWest) > 3);
  assert.ok(Math.abs(bearingDegrees(farmWest, receptor) - 90) < 1);
  assert.equal(deltaDegrees(0, 350), 10);
});
test('fall is identified as potential harvest/manure application season', () => {
  assert.equal(seasonForDate(timestamp).harvestSeason, true);
  assert.equal(seasonForDate('2026-07-01T12:00:00Z').harvestSeason, false);
  assert.equal(iowaTime('2026-10-21T18:00:00Z').dateKey, '2026-10-21');
});
test('downwind farm increases score vs same farm upwind', () => {
  const downwind = estimateOdor({ receptor, weather, farms: [farmWest], timestamp });
  const upwind = estimateOdor({ receptor, weather, farms: [farmEast], timestamp });
  assert.ok(downwind.index > upwind.index);
  assert.equal(downwind.topSources[0].swineAnimalUnits, 1000);
});
test('manure spreading yes boosts and no reduces index', () => {
  const base = { receptor, weather, farms: [farmWest], timestamp };
  const yes = estimateOdor({ ...base, manureStatus: 'yes' });
  const no = estimateOdor({ ...base, manureStatus: 'no' });
  assert.ok(yes.index > no.index);
});
test('zero mapped farms does not imply 100% no odor', () => {
  const result = estimateOdor({ receptor, weather, farms: [], timestamp });
  assert.equal(result.index, 7);
  assert.equal(result.sourceCount, 0);
});
test('missing wind direction is not silently treated as north', () => {
  const result = estimateOdor({ receptor, weather: { ...weather, windFromDeg: null }, farms: [farmWest], timestamp });
  assert.equal(result.windDirectionAvailable, false);
});
test('forecast peak uses future Iowa-local date and 3-hour weather points', () => {
  const now = new Date('2026-10-21T15:00:00Z').getTime();
  const forecasts = [
    { ...weather, windFromDeg: 90, timestampMs: now + 3 * 3600000 },
    { ...weather, windFromDeg: 270, timestampMs: now + 6 * 3600000 },
    { ...weather, windFromDeg: 270, timestampMs: now + 24 * 3600000 }
  ];
  const result = buildTodayForecast({ receptor, current: weather, forecasts,
    farms: [farmWest], now });
  assert.equal(result.timeline.length, 3);
  assert.equal(result.peak.time, new Date(now + 6 * 3600000).toISOString());
});
test('invalid model inputs are rejected', () => {
  assert.throws(() => estimateOdor({ receptor, weather: { tempF: 4 }, farms: [] }), /required/);
  assert.throws(() => estimateOdor({ receptor, weather, farms: [], manureStatus: 'maybe' }), /Invalid/);
});
