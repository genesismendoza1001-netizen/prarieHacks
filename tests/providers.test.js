import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDnrFeature, normalizeWeather, selectLatestHogInventory,
  geocodeTown, facilitiesNear, pigInventory } from '../server/providers.js';

const demoFeature = {
  attributes: { FID: 1, FacilityID: 432, FacilityNa: 'Test', Latitude: 41.7, Longitude: -92.7,
    TotalAnima: 2000, Swine_Grow: 800, Swine_Sow: 200, OpeartionT: 'Confinement' },
  geometry: { x: -92.7, y: 41.7 }
};
test('DNR animal-unit fields are not treated as pig head counts', () => {
  const f = normalizeDnrFeature(demoFeature);
  assert.equal(f.swineAnimalUnits, 1000);
  assert.equal(f.totalAnimalUnits, 2000);
  assert.equal(f.id, '432');
});
test('OpenWeather forecast normalizes current fields with imperial units', () => {
  const f = normalizeWeather({ dt: 1720000000, main: { temp: 76, humidity: 45 }, wind: { speed: 9, deg: 220 } });
  assert.equal(f.tempF, 76);
  assert.equal(f.windFromDeg, 220);
  assert.equal(f.timestampMs, 1720000000000);
});
test('NASS pig inventory chooses latest comparable quarterly total', () => {
  const base = { short_desc: 'HOGS - INVENTORY', class_desc: 'ALL CLASSES',
    domain_desc: 'TOTAL', agg_level_desc: 'STATE', unit_desc: 'HEAD' };
  const best = selectLatestHogInventory([
    { ...base, Value: '24,700,000', year: '2026', reference_period_desc: 'SEP 1' },
    { ...base, Value: '24,200,000', year: '2026', reference_period_desc: 'MAR 1' },
    { ...base, Value: '4,700,000', year: '2026', reference_period_desc: 'DEC 1', class_desc: 'BREEDING' }
  ]);
  assert.equal(best.value, 24_700_000);
  assert.equal(best.asOf, '2026-09-01');
});
test('geocoder rejects out-of-state result', async () => {
  await assert.rejects(() => geocodeTown('Chicago', { googleKey: 'dummy', fetcher: async () => ({ status: 'ZERO_RESULTS', results: [] }) }), /No Iowa town/);
});
test('DNR ArcGIS response parses and filters locally to radius', async () => {
  const result = await facilitiesNear(41.7, -92.7, { radiusKm: 30, fetcher: async url => {
    assert.equal(url.searchParams.get('inSR'), '4326');
    assert.equal(url.searchParams.get('outSR'), '4326');
    return { features: [demoFeature] };
  } });
  assert.equal(result.facilities.length, 1);
  assert.equal(result.complete, true);
});
test('pig count falls back to official dated USDA snapshot without API key', async () => {
  const result = await pigInventory({ key: '' });
  assert.equal(result.value, 24700000);
  assert.equal(result.live, false);
});
