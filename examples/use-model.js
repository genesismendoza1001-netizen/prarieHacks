// Illustrates importing EVERY model variable from another JavaScript file.
// This example is deliberately synthetic and does not call external APIs.
import { conditions } from './external-inputs.js';
import { estimateOdor } from '../server/model.js';
const result = estimateOdor(conditions);
console.log(JSON.stringify({
  warning: 'SYNTHETIC EXAMPLE ONLY — NOT A REAL FORECAST',
  index: result.index, band: result.band, topSources: result.topSources
}, null, 2));
