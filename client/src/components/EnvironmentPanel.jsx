import { useEffect, useState } from 'react';
import { api } from '../api.js';

const palette = n => n <= 50 ? '#4d9f71' : n <= 100 ? '#b39c3e' : n <= 150 ? '#cb7e43' : n <= 200 ? '#c65151' : '#904977';
const niceTime = iso => {
  if (!iso || Number.isNaN(Date.parse(iso))) return 'Time not reported';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
};
const number = (value, digits = 1) => Number.isFinite(value) ? Number(value).toFixed(digits) : '—';

function AirQualityCard({ result, odor }) {
  const aqi = result?.air;
  return <article className="card eco-card air-card">
    <div className="card-top"><span className="section-kicker">TWO DIFFERENT MEASUREMENTS</span><span className="emoji-small">🌬️</span></div>
    <h2>Air quality vs. stink quality</h2>
    <p className="muted">A smell-risk estimate is not an EPA air-quality measurement.</p>
    <div className="eco-duo">
      <div className="eco-metric odor"><span className="eco-label">🐽 ESTIMATED STINK</span>
        <strong>{odor?.index ?? '—'}<small> / 100</small></strong>
        <span>{odor?.band ? `${odor.band} modeled risk` : 'Run a stink forecast first'}</span>
        <small>Heuristic · Not a probability or gas monitor</small></div>
      <div className="eco-metric clean"><span className="eco-label">🍃 EPA AIR QUALITY INDEX</span>
        <strong style={{ color: aqi?.available ? palette(aqi.aqi) : undefined }}>{aqi?.available ? aqi.aqi : '—'}<small> AQI</small></strong>
        <span>{aqi?.available ? `${aqi.category} · ${aqi.dominantPollutant}` : 'No measured AQI available'}</span>
        <small>{aqi?.available ? `${aqi.reportingArea || 'AirNow reporting area'} · ${aqi.observedDate || 'Latest observation'}` : (aqi?.reason || 'Choose a location to fetch AirNow observations')}</small></div>
    </div>
    <p className="fineprint">AQI is reported for an AirNow reporting area, not necessarily at your exact address. Odor can be noticeable even when AQI is good, and harmful air pollution can occur without a manure odor. <a href="https://docs.airnowapi.org/webservices" target="_blank" rel="noreferrer">EPA AirNow ↗</a></p>
  </article>;
}

function RainfallBox({ rain }) {
  return <div className="rainfall-box">
    <div className="rain-top"><span>🌧️ Rainfall & nutrient runoff context</span><b>{rain?.label || 'Forecast unavailable'}</b></div>
    <div className="rain-metrics">
      <div><strong>{rain ? number(rain.observedLastHourMm) : '—'} <small>mm</small></strong><span>Observed rain / last hour</span></div>
      <div><strong>{rain ? number(rain.forecastNext24hMm) : '—'} <small>mm</small></strong><span>Forecast rain / next 24h</span></div>
    </div>
    <p>{rain?.explanation || 'Live OpenWeather precipitation information appears after your location loads.'}</p>
    <small>{rain?.warning || 'Rainfall alone cannot establish nutrient runoff.'} 3-hour forecasts are coarse and may not cover an exact 24-hour period.</small>
  </div>;
}

function WaterQualityCard({ result, loading }) {
  const water = result?.water;
  const stations = water?.stations || [];
  return <article className="card eco-card water-card">
    <div className="card-top"><span className="section-kicker">IOWA STREAM HEALTH</span><span className="emoji-small">💧</span></div>
    <h2>Water quality tracker</h2>
    <p className="muted">Actual USGS sensor readings from streams near the selected location, with measurement times and units.</p>
    <RainfallBox rain={result?.rainfall}/>
    {loading && <p className="muted">Fetching current water-quality readings…</p>}
    {!loading && !stations.length && <div className="eco-empty">No recent USGS stream measurements were returned for this area. Nitrate and dissolved-oxygen monitoring are not available at every station. Try the <a href="https://iwqis.iowawis.org/" target="_blank" rel="noreferrer">Iowa Water Quality Information System ↗</a>.</div>}
    {stations.length > 0 && !stations.some(st => st.readings.some(r => ['00631', '00618', '00300'].includes(r.code))) && <p className="fineprint">The returned stations do not have recent nitrate or dissolved-oxygen readings. Other measured parameters are shown below.</p>}
    <div className="water-stations">{stations.map(station => <section key={station.id} className="water-station">
      <div className="water-station-heading"><strong>{station.name}</strong><span>{number(station.distanceKm)} km away</span></div>
      <div className="readings-grid">{station.readings.map(reading => <div className="water-reading" key={`${station.id}:${reading.code}`}>
        <small>{reading.label}</small><strong>{number(reading.value, reading.code === '00400' ? 2 : 1)} <span>{reading.units || '(unit not provided)'}</span></strong>
        <small>Measured {niceTime(reading.measuredAt)}</small>
      </div>)}</div>
      <a className="fact-link" target="_blank" rel="noreferrer" href={`https://waterdata.usgs.gov/monitoring-location/${encodeURIComponent(station.id)}/`}>USGS station details ↗</a>
    </section>)}</div>
    <p className="fineprint">Nitrate + nitrite (as nitrogen) is not the same as nitrate alone. These are stream observations, not drinking-water safety assessments. High readings cannot be attributed to any particular livestock facility without evidence. Readings may be up to seven days old. <a href="https://waterservices.usgs.gov/nwis/iv/" target="_blank" rel="noreferrer">USGS source ↗</a> · <a href="https://iwqis.iowawis.org/" target="_blank" rel="noreferrer">Iowa nitrate network ↗</a></p>
  </article>;
}

export default function EnvironmentPanel({ location, odor }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!location) { setResult(null); return; }
    let active = true;
    setResult(null); setLoading(true); setError('');
    api.environment(location).then(data => { if (active) setResult(data); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [location?.lat, location?.lon]);
  return <section id="eco-dashboard" aria-label="Environmental conditions">
    <div className="eco-section-heading"><div><span className="section-kicker">THE ECO-PIG REPORT</span><h2>Beyond the barnyard 🌱</h2></div><p>Measured readings stay separate from our experimental odor forecast.</p></div>
    {error && <div className="alert error" role="status">Environmental data could not load: {error}</div>}
    {result?.warnings?.length > 0 && <div className="alert" role="status">{result.warnings.join(' ')}</div>}
    <div className="eco-grid"><AirQualityCard result={result} odor={odor}/><WaterQualityCard result={result} loading={loading}/></div>
  </section>;
}
