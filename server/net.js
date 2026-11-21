// Server-side only. Keys are never sent to the browser or included in errors.
const cache = new Map();

export class ProviderError extends Error {
  constructor(service, message, status = 502) {
    super(message);
    this.name = 'ProviderError';
    this.service = service;
    this.status = status;
  }
}

export async function fetchJSON(url, { service = 'Upstream', ttlMs = 0, timeoutMs = 11000, fetchImpl = fetch } = {}) {
  const key = url.toString();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
  } catch {
    throw new ProviderError(service, `${service} is temporarily unreachable or timed out.`);
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status)) throw new ProviderError(service, `${service} refused access. Check the API key, API activation and quota.`, 502);
    if (response.status === 429) throw new ProviderError(service, `${service} rate limit exceeded. Try again later.`, 503);
    throw new ProviderError(service, `${service} request failed (${response.status}).`);
  }
  let json;
  try { json = await response.json(); }
  catch { throw new ProviderError(service, `${service} returned invalid JSON.`); }
  if (json?.error) throw new ProviderError(service, `${service} returned an error.`);
  if (ttlMs > 0) {
    if (cache.size > 500) cache.clear();
    cache.set(key, { expires: Date.now() + ttlMs, value: json });
  }
  return json;
}
