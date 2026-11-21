// Run from project root: node --env-file=.env examples/use-live-api.js
// This requires the Google server key for town searches, and OpenWeather key.
import { getOdorDashboard, getPigCounter } from '../server/appService.js';
const dashboard = await getOdorDashboard({ town: 'Ames', manureStatus: 'unknown' });
const pigCount = await getPigCounter();
console.log(JSON.stringify({ location: dashboard.location,
  forecast: dashboard.prediction.current,
  peak: dashboard.prediction.peak,
  pigCount
}, null, 2));
