/** All requests remain relative: Vite proxies /api to the existing Node backend. */
async function request(path, options = {}) {
  const response = await fetch(path, options);
  let body;
  try { body = await response.json(); }
  catch { throw new Error(`Unexpected response from server (${response.status})`); }
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

export const api = {
  config: () => request('/api/config'),
  health: () => request('/api/health'),
  pigs: () => request('/api/pigs'),
  facts: () => request('/api/facts'),
  predict: ({ town, lat, lon, manureStatus = 'unknown' }) => {
    const params = new URLSearchParams({ manureStatus });
    if (town) params.set('town', town);
    else { params.set('lat', String(lat)); params.set('lon', String(lon)); }
    return request(`/api/predict?${params.toString()}`);
  },
  environment: ({ lat, lon }) => request(`/api/environment?${new URLSearchParams({ lat: String(lat), lon: String(lon) })}`),
  report: ({ lat, lon, level, consent }) => request('/api/observations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, level: Number(level), consent })
  })
};
