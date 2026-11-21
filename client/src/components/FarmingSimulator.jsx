import { useState } from 'react';

const METHODS = {
  surface: { icon: '🌾', title: 'Surface broadcast', odor: 100, nutrient: 40, effort: 10, desc: 'Manure stays on top of the soil; typically greater immediate odor and ammonia volatilization.' },
  incorporate: { icon: '🚜', title: 'Broadcast + prompt incorporation', odor: 50, nutrient: 67, effort: 45, desc: 'Mixing manure into soil promptly may cut emissions, but tillage can disturb soil.' },
  inject: { icon: '🌱', title: 'Subsurface injection', odor: 15, nutrient: 83, effort: 78, desc: 'Putting manure under soil generally reduces odor and ammonia loss, but needs equipment and may disturb soil.' }
};

function judge({ method, rain, wet, buffer }) {
  const m = METHODS[method];
  // Game scores are designer-chosen educational values, not field-calibrated percentages.
  const score = Math.min(100, Math.max(0,
    40 + (100 - m.odor) * .31 + m.nutrient * .20 - m.effort * .10
      - (rain ? 23 : 0) - (wet ? 22 : 0) + (buffer ? 17 : -10)
  ));
  const feedback = [];
  if (rain) feedback.push('Pause application: forecast heavy rain increases the chance of nutrient movement from a field.');
  if (wet) feedback.push('Avoid working saturated soil: compaction and runoff concerns can outweigh other benefits.');
  if (!buffer) feedback.push('Keep adequate setbacks and vegetated buffers near waterways, following local rules.');
  if (method === 'inject') feedback.push('Injection often cuts odor and ammonia loss, but could increase soil disturbance or nitrous oxide under some conditions.');
  if (method === 'surface') feedback.push('Consider rapid incorporation or injection where appropriate to reduce surface emissions.');
  if (!feedback.length) feedback.push('Thoughtful timing, weather checks, and buffers can reduce environmental risks.');
  return { score: Math.round(score), feedback };
}

export default function FarmingSimulator() {
  const [method, setMethod] = useState('surface');
  const [rain, setRain] = useState(false);
  const [wet, setWet] = useState(false);
  const [buffer, setBuffer] = useState(true);
  const [round, setRound] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const evaluation = judge({ method, rain, wet, buffer });
  const details = METHODS[method];
  function reset() { setMethod('surface'); setRain(false); setWet(false); setBuffer(true); setSubmitted(false); setRound(x => x + 1); }
  return <section id="farm-simulator" className="card simulator-card" aria-label="Sustainable manure management education game">
    <div className="card-top"><span className="section-kicker">SUSTAINABLE FARMING MINI-GAME</span><span className="small-badge">ROUND {round} · EDUCATIONAL</span></div>
    <div className="eco-section-heading"><div><h2>Be the eco-farmer 🐷🌱</h2><p>Help a hypothetical Iowa farm apply manure while considering smells, nutrients, weather, and field conditions.</p></div><span className="sim-pig" aria-hidden="true">🚜</span></div>
    <div className="sim-columns">
      <div>
        <h3>1. Choose an application technique</h3>
        <div className="method-grid">{Object.entries(METHODS).map(([id, item]) => <button type="button" key={id} className={`method-button ${method === id ? 'selected' : ''}`} aria-pressed={method === id} onClick={() => { setMethod(id); setSubmitted(false); }}>
          <span>{item.icon}</span><strong>{item.title}</strong>
        </button>)}</div>
        <h3>2. Make field decisions</h3>
        <div className="sim-decisions">
          <label><input type="checkbox" checked={rain} onChange={e => { setRain(e.target.checked); setSubmitted(false); }}/> Heavy rain expected soon</label>
          <label><input type="checkbox" checked={wet} onChange={e => { setWet(e.target.checked); setSubmitted(false); }}/> Soil is saturated / waterlogged</label>
          <label><input type="checkbox" checked={buffer} onChange={e => { setBuffer(e.target.checked); setSubmitted(false); }}/> Keep protective buffers and setbacks by streams</label>
        </div>
        <button type="button" className="primary-btn sim-button" onClick={() => setSubmitted(true)}>Check my farm plan →</button>
      </div>
      <div className="simulation-results">
        <span className="section-kicker">YOUR CHOSEN METHOD</span><h3>{details.icon} {details.title}</h3><p>{details.desc}</p>
        <div className="scenario-metrics">
          <div><span>Illustrative relative odor</span><b>{details.odor} <small>/100</small></b><div className="small-track"><i style={{ width: `${details.odor}%`, background: '#df7196' }}/></div></div>
          <div><span>Illustrative nitrogen-retention potential</span><b>{details.nutrient} <small>/100</small></b><div className="small-track"><i style={{ width: `${details.nutrient}%`, background: '#6b9c79' }}/></div></div>
          <div><span>Illustrative equipment/effort</span><b>{details.effort} <small>/100</small></b><div className="small-track"><i style={{ width: `${details.effort}%`, background: '#ad92be' }}/></div></div>
        </div>
        {submitted && <div className="sim-outcome" role="status"><strong>🐽 Farm stewardship score: {evaluation.score}/100</strong>
          <p>Game points only — not measured pollution, an efficiency percentage, or a regulatory assessment.</p>
          <ul>{evaluation.feedback.map(x => <li key={x}>{x}</li>)}</ul>
          <button className="text-btn" type="button" onClick={reset}>Try another round ↻</button>
        </div>}
      </div>
    </div>
    <div className="note-bar"><span>💡</span><span>Iowa State research reports that manure injection can reduce odor release by <strong>more than 90% in some comparisons</strong> with surface broadcasting. The mini-game's 0–100 scores are illustrative, not measured effect sizes. Real tradeoffs depend on soil, equipment, manure type and weather. <a href="https://www.porkgateway.iastate.edu/resource/swine-manure-and-land-application-practices-minimize-odors" target="_blank" rel="noreferrer">Iowa State research ↗</a> · <a href="https://www.extension.iastate.edu/ampat/application-methods" target="_blank" rel="noreferrer">Practice tradeoffs ↗</a></span></div>
  </section>;
}
