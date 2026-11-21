import { createServer as httpCreateServer } from 'node:http';
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONFIG } from './config.js';
import { ProviderError } from './net.js';
import { FACTS } from './facts.js';
import { getOdorDashboard, getPigCounter } from './appService.js';
import { validIowaCoordinate } from './geo.js';
import { getEnvironmentDashboard } from './environment.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Serve the built React app when available; otherwise serve the original static UI.
const BUILD_DIR = join(ROOT, 'client', 'dist');
const PUBLIC = existsSync(join(BUILD_DIR, 'index.html')) ? BUILD_DIR : join(ROOT, 'app');
const REPORTS = join(ROOT, 'data', 'odor-reports.ndjson');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
async function bodyJSON(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString('utf8');
    if (body.length > 12000) throw new Error('Request body is too large.');
  }
  try { return JSON.parse(body); }
  catch { throw new Error('Please send valid JSON.'); }
}
async function serveStatic(url, res) {
  const rawPath = decodeURIComponent(url.pathname);
  const target = resolve(PUBLIC, '.' + normalize(rawPath === '/' ? '/index.html' : rawPath));
  if (!target.startsWith(PUBLIC + sep)) return json(res, 403, { error: 'Forbidden.' });
  try {
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=180', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self' https://*.googleapis.com https://*.gstatic.com; img-src 'self' data: https://*.googleapis.com https://*.gstatic.com https://*.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' https://maps.googleapis.com https://maps.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.gstatic.com; frame-src 'none'; object-src 'none'; base-uri 'self'" });
    res.end(data);
  } catch { json(res, 404, { error: 'Not found.' }); }
}

const rateHistory = new Map();
function tooManyRequests(req) {
  const ip = req.socket.remoteAddress || 'anonymous';
  const now = Date.now();
  if (rateHistory.size > 4000) rateHistory.clear();
  const history = (rateHistory.get(ip) || []).filter(x => now - x < 60_000);
  history.push(now);
  rateHistory.set(ip, history);
  return history.length > 40;
}

export function createAppServer(deps = {}) {
  return httpCreateServer(async (req, res) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); }
    catch { return json(res, 400, { error: 'Invalid URL.' }); }
    try {
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
        return await serveStatic(url, res);
      }
      if (tooManyRequests(req)) return json(res, 429, { error: 'Too many requests; please try again shortly.' });
      if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, {
        status: 'ok', services: { openWeatherConfigured: !!CONFIG.openWeatherKey,
          googleGeocodingConfigured: !!CONFIG.googleServerKey, googleMapConfigured: !!CONFIG.googleBrowserKey,
          nassConfigured: !!CONFIG.nassKey, airNowConfigured: !!CONFIG.airNowKey, iowaDnr: 'public GIS service' }
      });
      if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, {
        googleMapsBrowserKey: CONFIG.googleBrowserKey,
        townSearchEnabled: !!CONFIG.googleServerKey,
        weatherConfigured: !!CONFIG.openWeatherKey
      });
      if (req.method === 'GET' && url.pathname === '/api/facts') return json(res, 200, { facts: FACTS });
      if (req.method === 'GET' && url.pathname === '/api/pigs') return json(res, 200, await (deps.getPigCounter || getPigCounter)());
      if (req.method === 'GET' && url.pathname === '/api/environment') {
        const input = { lat: url.searchParams.get('lat'), lon: url.searchParams.get('lon') };
        return json(res, 200, await (deps.getEnvironmentDashboard || getEnvironmentDashboard)(input));
      }
      if (req.method === 'GET' && url.pathname === '/api/predict') {
        const town = url.searchParams.get('town');
        const manureStatus = url.searchParams.get('manureStatus') || 'unknown';
        const input = town ? { town, manureStatus } : {
          lat: url.searchParams.get('lat'), lon: url.searchParams.get('lon'), manureStatus
        };
        return json(res, 200, await (deps.getOdorDashboard || getOdorDashboard)(input));
      }
      if (req.method === 'POST' && url.pathname === '/api/observations') {
        const data = await bodyJSON(req);
        if (data.consent !== true) throw new Error('Explicit consent is required to save an odor observation.');
        const { lat, lon, level } = data;
        if (!validIowaCoordinate(Number(lat), Number(lon))) throw new Error('Observation location must be in Iowa.');
        if (!Number.isInteger(level) || level < 0 || level > 4) throw new Error('Odor level must be 0, 1, 2, 3, or 4.');
        const observation = {
          timestamp: new Date().toISOString(),
          // Rounded to roughly kilometer precision for privacy; no names, IPs, or account identifiers.
          approxLat: +Number(lat).toFixed(2), approxLon: +Number(lon).toFixed(2), level
        };
        await mkdir(dirname(REPORTS), { recursive: true });
        await appendFile(REPORTS, JSON.stringify(observation) + '\n', { mode: 0o600 });
        return json(res, 201, { saved: true, note: 'Stored locally on this server; not used to retrain the model automatically.' });
      }
      return json(res, 404, { error: 'Unknown API endpoint.' });
    } catch (error) {
      const status = error instanceof ProviderError ? error.status :
        error instanceof TypeError ? 400 :
          error.message?.match(/invalid|enter|choose|town|consent|must|too long|large|missing|Iowa|status|valid JSON/i) ? 400 : 502;
      // Do not return request URLs (which may contain server-side API keys).
      json(res, status, { error: error.message || 'Request failed.', service: error.service || undefined });
    }
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  createAppServer().listen(CONFIG.port, () => {
    console.log(`GrinnSmell available at http://localhost:${CONFIG.port}`);
    console.log('API keys loaded:', { openWeather: !!CONFIG.openWeatherKey, googleGeocoding: !!CONFIG.googleServerKey,
      googleBrowserMap: !!CONFIG.googleBrowserKey, nass: !!CONFIG.nassKey, airNow: !!CONFIG.airNowKey });
  });
}