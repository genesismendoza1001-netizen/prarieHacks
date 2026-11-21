import test from 'node:test';
import assert from 'node:assert/strict';
import { airQualityFor, normalizeAirNow, normalizeUSGS, rainfallContext, getEnvironmentDashboard, waterQualityFor } from '../server/environment.js';
import { createAppServer } from '../server/index.js';

const receptor = { lat: 41.7434, lon: -92.7247 };
const now = Date.parse('2026-11-21T18:00:00Z');

test('AirNow uses the post-September-2026 current-observations endpoint and selects peak pollutant AQI', async () => {
  const got = await airQualityFor(receptor.lat, receptor.lon, { key: 'mock-secret', fetcher: async url => {
    assert.match(url.pathname, /\/observation\/current\/ziplatlong\/?$/i);
    assert.equal(url.searchParams.get('latitude'), String(receptor.lat));
    assert.equal(url.searchParams.get('API_KEY'), 'mock-secret');
    return [
      { AQI: 33, ParameterName: 'PM2.5', Category: { Name: 'Good' }, ReportingArea: 'Central IA' },
      { AQI: 62, ParameterName: 'O3', Category: { Name: 'Moderate' }, ReportingArea: 'Central IA' }
    ];
  }});
  assert.equal(got.aqi, 62);
  assert.equal(got.dominantPollutant, 'O3');
  assert.equal(got.type.includes('Measured'), true);
  assert.equal(normalizeAirNow([]).available, false);
});

test('USGS JSON normalizer preserves station, units, date and nitrate/dissolved-oxygen measurements', () => {
  const base = {
    sourceInfo: { siteCode: [{ value: '05452000' }], siteName: 'Sample Creek', geoLocation: { geogLocation: { latitude: 41.744, longitude: -92.725 } } },
    variable: { variableCode: [{ value: '00631' }], unit: { unitCode: 'mg/L' }, variableName: 'Nitrate plus nitrite, water, as nitrogen' },
    values: [{ value: [{ value: '3.8', dateTime: '2026-11-21T17:00:00Z' }] }]
  };
  const data = { value: { timeSeries: [base, {
    ...base, variable: { variableCode: [{ value: '00300' }], unit: { unitCode: 'mg/L' } },
    values: [{ value: [{ value: '8.2', dateTime: '2026-11-21T16:00:00Z' }] }]
  }] } };
  const results = normalizeUSGS(data, receptor, { now });
  assert.equal(results.length, 1);
  assert.equal(results[0].readings.length, 2);
  assert.deepEqual(results[0].readings.map(x => x.value), [3.8, 8.2]);
  assert.deepEqual(normalizeUSGS(data, receptor, { now: now + 10 * 86400_000 }), []);
});

test('USGS provider requests time-series readings using a bounded geographic area', async () => {
  const water = await waterQualityFor(receptor.lat, receptor.lon, { now, fetcher: async url => {
    assert.equal(url.searchParams.get('format'), 'json');
    assert.ok(url.searchParams.get('parameterCd').includes('00300'));
    assert.ok(url.searchParams.get('parameterCd').includes('00631'));
    return { value: { timeSeries: [] } };
  }});
  assert.equal(water.available, false);
  assert.equal(water.stations.length, 0);
});

test('rainfall is from OpenWeather precipitation fields, not an invented nitrate correlation', () => {
  const context = rainfallContext({ current: { rain1hMm: 2.1 }, forecasts: [
    { timestampMs: now + 3 * 3600_000, rain3hMm: 12 },
    { timestampMs: now + 6 * 3600_000, rain3hMm: 20 },
    { timestampMs: now + 48 * 3600_000, rain3hMm: 200 }
  ] }, now);
  assert.equal(context.forecastNext24hMm, 32);
  assert.equal(context.observedLastHourMm, 2.1);
  assert.match(context.warning, /NOT a water contamination prediction/);
});

test('environment endpoint isolates independent service failures and validates coordinates', async () => {
  const expected = await getEnvironmentDashboard(receptor, {
    now,
    air: async () => { throw new Error('Temporary outage'); },
    water: async () => ({ stations: [], available: false }),
    weather: async () => ({ current: { rain1hMm: 0 }, forecasts: [] })
  });
  assert.equal(expected.air.available, false);
  assert.equal(expected.water.available, false);
  assert.equal(expected.warnings.length, 1);
  await assert.rejects(() => getEnvironmentDashboard({ lat: 0, lon: 0 }), /Iowa/);

  const app = createAppServer({ getEnvironmentDashboard: async () => expected });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${app.address().port}/api/environment?lat=${receptor.lat}&lon=${receptor.lon}`);
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.location.lat, receptor.lat);
    assert.equal(json.air.available, false);
  } finally { await new Promise(resolve => app.close(resolve)); }
});
