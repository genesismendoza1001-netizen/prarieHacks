import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import MapPanel from './components/MapPanel.jsx';
import EnvironmentPanel from './components/EnvironmentPanel.jsx';
import FarmingSimulator from './components/FarmingSimulator.jsx';

const IOWA_TIME = 'America/Chicago';
const DNR_URL = 'https://services3.arcgis.com/kfmqp6kwSeDnDKNY/ArcGIS/rest/services/animal_feeding_operations/FeatureServer/0';
const initialFact = { emoji: '🌽', text: "Iowa's agriculture and manufacturing have some fascinating stories.", source: 'USDA NASS', url: 'https://www.nass.usda.gov/' };
function readableTime(value, opts = { hour: 'numeric', minute: '2-digit' }) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { timeZone: IOWA_TIME, ...opts }).format(new Date(value));
}
function cardinal(degrees) {
  if (!Number.isFinite(degrees)) return 'unknown';
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
}
const fixed = (x, digits = 1) => Number.isFinite(x) ? x.toFixed(digits) : '—';
function RiskCard({ data, loading }) {
  const risk = data?.prediction.current;
  return <article className="card risk-card">
    <div className="card-top"><span className="section-kicker">YOUR LOCAL FORECAST</span><span className="small-badge">{loading ? 'FETCHING LIVE DATA' : risk ? '● DATA + HEURISTICS' : 'WAITING FOR LIVE DATA'}</span></div>
    <h2>{data?.location.label || 'Ready to sniff around?'}</h2>
    <p className="muted">{data ? `Updated ${readableTime(data.generatedAt)} · Iowa local time · ${data.facilities.searchRadiusKm} km radius` : 'Search for an Iowa town or choose your location.'}</p>
    <div className="risk-body">
      <div className="meter" style={{ '--score': risk?.index || 0 }} role="img" aria-label={risk ? `Odor risk index ${risk.index} out of 100` : 'Odor risk not yet available'}>
        <div className="meter-inside"><span className="meter-number">{risk?.index ?? '—'}</span><span className="meter-unit">/100</span></div>
      </div>
      <div className="risk-details">
        <div className="risk-eyebrow">ODOR RISK INDEX</div>
        <div className="risk-label">{risk ? `${risk.band} risk` : 'No estimate yet'}</div>
        <p>{risk?.bandDescription || 'Live data is needed to calculate an index.'}</p>
        <span className="index-hint">Not a percent chance · Uncalibrated model</span>
      </div>
    </div>
    <div className="note-bar"><span aria-hidden="true">ⓘ</span><span>Index based on weather and mapped livestock facilities. It is not a validated probability of smelling manure.</span></div>
  </article>;
}
function WeatherCard({ data }) {
  const weather = data?.conditions;
  const farms = data?.facilities;
  const metrics = [
    ['↝', 'WIND', weather ? `${fixed(weather.windMph)} mph ${cardinal(weather.windFromDeg)}` : '—'],
    ['◌', 'HUMIDITY', weather ? `${Math.round(weather.humidity)}%` : '—'],
    ['🌾', 'NEARBY FACILITIES', farms?.totalNearby ?? '—'],
    ['🐖', 'WITH PIGS', farms?.pigFacilities ?? '—']
  ];
  return <article className="card today-card">
    <div className="card-top"><span className="section-kicker">TODAY'S CONDITIONS</span><span className="emoji-small">🌤️</span></div>
    <h2>Weather right now</h2>
    <div className="weather-current"><span className="weather-temp">{weather ? `${Math.round(weather.tempF)}°` : '—°'}</span><span className="weather-description">{weather?.description || 'Live weather will appear here.'}</span></div>
    <div className="mini-metrics">{metrics.map(([symbol, label, value]) => <div className="mini-metric" key={label}><span className="metric-symbol">{symbol}</span><span><small>{label}</small><strong>{value}</strong></span></div>)}</div>
    <p className="source-line">Weather: <a href="https://openweathermap.org/api/forecast5" target="_blank" rel="noreferrer">OpenWeather</a> · Facilities: <a href={DNR_URL} target="_blank" rel="noreferrer">Iowa DNR GIS</a></p>
  </article>;
}
function PeakCard({ data }) {
  const peak = data?.prediction.peak;
  const timeline = data?.prediction.timeline || [];
  return <article className="card peak-card">
    <div className="card-top"><span className="section-kicker">THE NEXT FEW HOURS</span><span className="icon-decor">✶</span></div>
    <div className="peak-header"><div><h2>When might it smell the most?</h2><p className="muted">{peak ? `Highest remaining forecast sample today: ${peak.band.toLowerCase()} risk (${peak.index}/100).` : 'OpenWeather 3-hour forecasts power this outlook.'}</p></div>
      <div className="peak-time"><small>FORECAST PEAK</small><strong>{peak ? readableTime(peak.time) : '—'}</strong></div></div>
    <div className="timeline" aria-label="Today odor risk forecast">{timeline.length ? timeline.slice(0, 9).map((point, i) => <div key={`${point.time}-${i}`} className={`time-col ${point.isCurrent ? 'current' : ''}`} title={`${readableTime(point.time)} — index ${point.index}`}>
      <div className="percent">{point.index}</div><div className="bar" style={{ height: `${Math.max(6, point.index * 1.02)}px` }}/><div className="time-label">{point.isCurrent ? 'Now' : readableTime(point.time, { hour: 'numeric' }).replace(' ', '')}</div>
    </div>) : <div className="timeline-empty">Your outlook will appear after your first forecast.</div>}</div>
    <p className="fineprint">Peak timing is the highest modeled 3-hour forecast point remaining today, not an exact odor event prediction.</p>
  </article>;
}
function SeasonCard({ data, manureStatus, onChange }) {
  const season = data?.conditions.season;
  const crop = data?.conditions.cropProgress;
  return <article className="card season-card">
    <div className="card-top"><span className="section-kicker">FROM FARM TO FIELD</span><span className="emoji-small">🌽</span></div>
    <h2>What's happening on the fields?</h2>
    <div className="season-panel"><span className="season-icon">🚜</span><div><strong>{season?.name || 'Seasonal context'}</strong><p className="muted">{season?.note || 'Spring and fall fieldwork can affect manure application.'}</p></div></div>
    <label className="select-label" htmlFor="manureSelect">DO YOU KNOW OF MANURE SPREADING NEARBY?</label>
    <select id="manureSelect" value={manureStatus} onChange={e => onChange(e.target.value)}>
      <option value="unknown">Not sure (use seasonal estimate)</option>
      <option value="yes">Yes, spreading is happening</option>
      <option value="no">No known spreading</option>
    </select>
    <p className="fineprint">{crop ? `USDA NASS corn harvest: ${crop.harvestedPct}% statewide as of ${crop.asOf}. This does not confirm local manure spreading.` : 'Actual local manure application events are not available from the DNR feed.'}</p>
  </article>;
}
function FacilityCard({ data, mapKey }) {
  const sources = data?.facilities?.nearby || [];
  return <article className="card map-card">
    <div className="card-top"><span className="section-kicker">NEIGHBORHOOD NOSE CHECK</span><span className="emoji-small">📍</span></div>
    <h2>Live stink map &amp; wind</h2>
    <MapPanel apiKey={mapKey} location={data?.location} sources={sources} windFromDeg={data?.conditions?.windFromDeg} windMph={data?.conditions?.windMph}/>
    <div className="source-list">{sources.length ? sources.slice(0, 4).map((s, i) => <div className="source-row" key={`${s.id}-${i}`}>
      <div><div className="source-name">{s.name}</div><div className="source-note">{s.swineAnimalUnits > 0 ? 'Pig-containing operation' : 'Other livestock operation'} · {Math.round(s.totalAnimalUnits || 0).toLocaleString()} animal units</div></div>
      <span className="source-distance">{fixed(s.distanceKm)} km</span>
    </div>) : <p className="muted">{data ? 'No regulated facilities returned nearby. Other odor sources may still exist.' : 'Facility contributions appear here after a forecast.'}</p>}</div>
    <a href={DNR_URL} target="_blank" rel="noreferrer" className="fact-link">Browse the full DNR dataset ↗</a>
    <p className="fineprint">Distances are geographic estimates. Animal units are not pig head counts. Smaller operations may be absent.</p>
  </article>;
}
function FactsCard({ pig, facts }) {
  const [factIndex, setFactIndex] = useState(0);
  const fact = facts.length ? facts[factIndex % facts.length] : initialFact;
  const count = Number.isFinite(pig?.value) ? pig.value >= 1e6 ? `${(pig.value / 1e6).toFixed(1)}M` : pig.value.toLocaleString() : '—';
  return <article className="card facts-card">
    <div className="card-top"><span className="section-kicker">HOG WILD NUMBERS</span><span className="emoji-small">🐖</span></div>
    <h2>We're serious about pigs.</h2>
    <div className="pig-stat"><div><div className="pig-number">{count}</div><div className="pig-caption">hogs & pigs in Iowa {pig?.asOf ? `(${pig.asOf})` : ''}</div></div><span className="big-pig" aria-hidden="true">🐷</span></div>
    <p className="pig-source">{pig?.attribution || 'USDA NASS'}{pig?.live ? ' · API data' : ' · dated snapshot'} · <a href={pig?.sourceUrl || 'https://quickstats.nass.usda.gov/'} target="_blank" rel="noreferrer">Source ↗</a></p>
    <div className="fact-divider"/><div className="fact-top"><strong>Did you know?</strong><button type="button" onClick={() => setFactIndex(i => i + 1)} className="text-btn">Another fun fact ↻</button></div>
    <div className="fact-contents"><span>{fact.emoji}</span><p>{fact.text}</p></div>
    <a href={fact.url} target="_blank" rel="noreferrer" className="fact-link">Source: {fact.source} ↗</a>
  </article>;
}
function ReportCard({ location }) {
  const [level, setLevel] = useState('0');
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!location) { setMessage('Find a location first.'); return; }
    if (!consent) { setMessage('Please check the consent box first.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await api.report({ lat: location.lat, lon: location.lon, level, consent });
      setMessage(response.note || 'Report saved on this server.');
      setConsent(false);
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  return <section className="community card">
    <div><span className="section-kicker">HELP IMPROVE THE FORECAST</span><h2>How does it actually smell outside?</h2><p className="muted">Send an optional 0–4 smell report. This stays on your server and is <strong>not</strong> used to retrain forecasts automatically.</p></div>
    <form className="observation-form" onSubmit={submit}>
      <label htmlFor="smellSelect">YOUR SMELL RATING</label>
      <select id="smellSelect" value={level} onChange={e => setLevel(e.target.value)}>{['No smell', 'Slight', 'Moderate', 'Strong', 'Very strong'].map((x, i) => <option value={i} key={i}>{i} — {x}</option>)}</select>
      <label className="consent-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> I agree to store my approximate location (~1 km) and odor rating on this server.</label>
      <button type="submit" disabled={busy} className="secondary-btn">{busy ? 'Sending…' : 'Submit smell report'}</button>
      <span className="observation-msg" role="status">{message}</span>
    </form>
  </section>;
}

export default function App() {
  const [town, setTown] = useState('Des Moines');
  const [manureStatus, setManureStatus] = useState('unknown');
  const [config, setConfig] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [facts, setFacts] = useState([]);
  const [pig, setPig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const requestCounter = useRef(0);
  const lastInput = useRef(null);

  const predict = useCallback(async (input) => {
    const request = ++requestCounter.current;
    lastInput.current = input;
    setLoading(true); setMessage(''); setError(false);
    try {
      const result = await api.predict(input);
      if (request !== requestCounter.current) return;
      setDashboard(result);
      setMessage(result.warnings?.length ? result.warnings.slice(0, 2).join(' ') : '');
    } catch (e) {
      if (request === requestCounter.current) { setMessage(e.message); setError(true); }
    } finally { if (request === requestCounter.current) setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.config(), api.facts(), api.pigs()]).then((out) => {
      if (!active) return;
      if (out[0].status === 'fulfilled') {
        const cfg = out[0].value;
        setConfig(cfg);
        if (cfg.townSearchEnabled && cfg.weatherConfigured) predict({ town: 'Des Moines', manureStatus: 'unknown' });
      } else { setMessage('Cannot reach backend server. Start it on port 3000.'); setError(true); }
      if (out[1].status === 'fulfilled') setFacts(out[1].value.facts || []);
      if (out[2].status === 'fulfilled') setPig(out[2].value);
    });
    return () => { active = false; };
  }, [predict]);

  function search(event) {
    event.preventDefault();
    if (!town.trim()) return;
    predict({ town: town.trim(), manureStatus });
  }
  function useLocation() {
    if (!navigator.geolocation) { setMessage('Location is not supported by this browser.'); setError(true); return; }
    setMessage('Requesting location permission…'); setError(false);
    navigator.geolocation.getCurrentPosition(
      pos => predict({ lat: pos.coords.latitude, lon: pos.coords.longitude, manureStatus }),
      err => { setMessage(`Could not get location: ${err.message}`); setError(true); },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  }
  function changeManure(next) {
    setManureStatus(next);
    if (lastInput.current) predict({ ...lastInput.current, manureStatus: next });
  }

  return <>
    <div className="backdrop-bloom bloom-one" aria-hidden="true"/><div className="backdrop-bloom bloom-two" aria-hidden="true"/>
    <div className="shell">
      <header className="topbar">
        <a href="/" className="brand" aria-label="GrinnSmell home"><span className="logo">🐽</span><span><strong>GrinnSmell</strong><small>THE IOWA SNIFF REPORT</small></span></a>
        <div className="header-end"><span className="live-chip"><i/> DATA-POWERED</span><span className="today-text">{readableTime(new Date(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
      </header>
      <main>
        <section className="hero"><div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot">✦</span> CORN COUNTRY WEATHER, WITH A TWIST</div>
          <h1>How <em>oinky</em> is it outside?</h1>
          <p>Check the day's potential manure odor with real weather, wind direction, and nearby Iowa livestock facilities.</p>
          <form className="search-card" onSubmit={search}>
            <label htmlFor="townInput">FIND YOUR IOWA FORECAST</label>
            <div className="search-row"><div className="input-wrap"><span aria-hidden="true">⌕</span><input id="townInput" value={town} onChange={e => setTown(e.target.value)} maxLength={100} autoComplete="address-level2" placeholder="Enter an Iowa town" required /></div>
              <button disabled={loading} className="primary-btn" type="submit">{loading ? 'Sniffing…' : 'Sniff it'} <span aria-hidden="true">→</span></button></div>
            <div className="geo-row"><button type="button" onClick={useLocation} className="text-btn">◎ Use my current location</button><span className="tiny-separator">·</span><span>Location is sent to weather and facility services for this request only.</span></div>
          </form>
        </div><div className="mascot" aria-hidden="true"><div className="mascot-sun">☀</div><div className="mascot-pig">🐷</div><div className="mascot-wind w1">〰</div><div className="mascot-wind w2">〰</div><span className="mascot-caption">SNIFF SNIFF...</span></div></section>
        {message && <div className={`alert ${error ? 'error' : ''}`} role="status">{message}</div>}
        <section className="summary-grid" aria-label="Odor forecast summary"><RiskCard data={dashboard} loading={loading}/><WeatherCard data={dashboard}/></section>
        <section className="details-grid"><PeakCard data={dashboard}/><SeasonCard data={dashboard} manureStatus={manureStatus} onChange={changeManure}/></section>
        <section className="details-grid bottom-grid"><FacilityCard data={dashboard} mapKey={config?.googleMapsBrowserKey}/><FactsCard pig={pig} facts={facts}/></section>
        <EnvironmentPanel location={dashboard?.location} odor={dashboard?.prediction?.current}/>
        <FarmingSimulator/>
        <ReportCard location={dashboard?.location}/>
      </main>
      <footer><span>🐽 GrinnSmell · Made for curious Iowans</span><span>Informational only · Not an odor exposure or health warning service · <a href="https://www.iowadnr.gov/environmental-protection/animal-feeding-operations/afo-online-services" target="_blank" rel="noreferrer">DNR data details ↗</a></span></footer>
    </div>
  </>;
}
