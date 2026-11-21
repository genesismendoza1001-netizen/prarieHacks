import test from 'node:test';
import assert from 'node:assert/strict';
import { getOdorDashboard } from '../server/appService.js';

const now = new Date('2026-11-21T18:00:00Z').getTime();
const resultProviders = {
  now,
  geocode: async town => ({ label: `${town}, IA, USA`, lat: 41.7434, lon: -92.7247, source: 'mock' }),
  weather: async () => ({ current: { tempF: 50, humidity: 72, windMph: 7, windFromDeg: 260 },
    forecasts: [{ tempF: 48, humidity: 75, windMph: 6, windFromDeg: 275, timestampMs: now + 3 * 3600000 }] }),
  facilities: async () => ({ radiusKm: 30, complete: true, sourceUrl: 'mockGIS', facilities: [
    { id: '1', name: 'sample', lat: 41.7434, lon: -92.77, totalAnimalUnits: 1000, swineAnimalUnits: 900 } ] }),
  cropProgress: async () => null
};
test('all external providers can be injected from a separate JavaScript file', async () => {
  const data = await getOdorDashboard({ town: 'Grinnell', manureStatus: 'unknown' }, resultProviders);
  assert.equal(data.location.label, 'Grinnell, IA, USA');
  assert.equal(data.model.calibrated, false);
  assert.equal(data.facilities.pigFacilities, 1);
  assert.ok(data.prediction.current.index > 7);
  assert.equal(data.prediction.timeline.length, 2);
  assert.equal(data.prediction.peak.resolution.startsWith('3-hour'), true);
});
test('provider results are required; missing or bad geocoding is rejected', async () => {
  await assert.rejects(() => getOdorDashboard({ lat: 32, lon: 0 }, resultProviders), /Iowa/);
  await assert.rejects(() => getOdorDashboard({ town: 'Grinnell', manureStatus: 'not sure' }, resultProviders), /status/);
});
