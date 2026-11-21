# Adding React to Piggy Forecast (existing Node backend retained)

This folder includes a ready-to-run **React + Vite** frontend in `client/` using the existing pink styles and existing Node APIs. It preserves all the existing forecasting calculations in `server/model.js`, all the Google/OpenWeather/DNR/USDA providers, and the smell report endpoint. React does not have or need private API keys.

## Requirements

Node.js 22.12+ (check with `node -v`). Vite 7 supports Node 20.19+ or 22.12+; Node 22.12+ is a simple common version across backend and frontend.

## First-time setup

In the folder containing `package.json`, run:

```sh
npm run install:client
```

Create `.env` from `.env.example` and fill in the keys on the **server only**:

```dotenv
OPENWEATHER_API_KEY=your_openweather_key
GOOGLE_MAPS_SERVER_KEY=your_geocoding_key
GOOGLE_MAPS_BROWSER_KEY=your_restricted_maps_javascript_key
NASS_API_KEY=your_optional_nass_key
PORT=3000
```

Use different Google Maps keys for browser and server. In Google Cloud Console, enable **Geocoding API** for the server key and **Maps JavaScript API** for the browser key. Set browser referrers to **http://localhost:5173/*** during Vite development and **http://localhost:3000/*** when serving a production build locally. Restrict the browser key to Maps JavaScript API. Server secrets stay only in `.env`, not in `client/` or a `VITE_` variable.

## Development: run two terminals

Terminal A (Node API, port 3000):

```sh
npm run dev:server
```

Terminal B (React/Vite, port 5173):

```sh
npm run dev:client
```

**Open http://localhost:5173** to see React. Vite proxies URLs beginning `/api/` to `http://127.0.0.1:3000`; the browser code simply calls `fetch('/api/predict?...')`. The Google browser key is returned from `/api/config`; it is intentionally public but referrer/API restricted. No CORS hack is needed.

## Build and run React through the Node server

```sh
npm run build
npm start
```

Open **http://localhost:3000**. `server/index.js` serves `client/dist/` when it exists, otherwise falls back to the original `public/` vanilla frontend. Restart the Node server after building.

## File layout

```
piggy-forecast-react/
├── .env.example                # Original env vars; copy to .env
├── package.json                # Node backend scripts and React helper scripts
├── server/
│   ├── index.js                # HTTP API and static React bundle host
│   ├── appService.js           # Joins provider responses for dashboard
│   ├── model.js                # Existing odor risk model (unchanged)
│   └── providers.js            # Google/OpenWeather/DNR/NASS (unchanged)
├── client/
│   ├── package.json            # React + Vite dependencies
│   ├── vite.config.js          # /api proxy to Node on port 3000
│   ├── index.html              # React's root element
│   └── src/
│       ├── main.jsx           # Mounts React app
│       ├── App.jsx            # React dashboard, search, forecast and facts
│       ├── api.js             # Calls existing Node endpoints
│       ├── styles.css         # Original pink Piggy Forecast styling
│       └── components/
│           └── MapPanel.jsx   # Google Maps and facility markers
├── tests/                      # Original Node tests
└── public/                     # Original interface retained as fallback
```

## Example API usage in React

```jsx
import { useState } from 'react';
import { api } from './api.js';

export default function Example() {
  const [result, setResult] = useState(null);
  return <>
    <button onClick={async () => setResult(await api.predict({town:'Grinnell',manureStatus:'unknown'}))}>Get forecast</button>
    <p>Risk index: {result?.prediction?.current?.index ?? '—'}/100</p>
  </>;
}
```

## Important limitation

**0–100 is an uncalibrated odor-risk index, not a percentage probability.** DNR facility records do not reveal real-time manure spreading. Today's peak is the highest modeled remaining 3-hour OpenWeather sample, not a verified odor event. This app is not a health/air quality alert service.

## Diagnostics

- `npm test`: runs backend tests without external credentials.
- `http://localhost:3000/api/health`: confirms configured keys.
- `http://localhost:3000/api/facts`: test route without a key.
- React blank screen: check Vite console, `npm run install:client`, and that you opened port 5173.
- Proxy 500/502: confirm port 3000 backend is running and OpenWeather/Geocoding keys work.
- Map blank: confirm Maps JavaScript API enabled and HTTP referrer includes port **5173** during development.
- `npm start` still shows old non-React UI: run `npm run build`, then restart the Node backend.
