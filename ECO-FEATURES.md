# GrinnSmell — Eco Edition

This release extends the supplied `prarieHacks-fixed(1).zip`. The Node server, React UI, forecasting model, Google Maps, OpenWeather, DNR GIS, seasonal estimates, USDA pigs, and user smell reports remain part of the project.

## Quick start

Requires Node.js >= 22.12.0.

```bash
# from the folder containing package.json
cp .env.example .env                 # Git Bash / macOS / Linux
# or on Windows PowerShell: Copy-Item .env.example .env
# edit .env to add keys (do NOT commit this file)
npm run install:client
npm run dev:server                   # terminal 1
npm run dev:client                   # terminal 2
```

Open **http://localhost:5173** for the React dashboard. **http://localhost:3000/api/health** checks the Node backend. Running only `dev:server` will NOT launch the React development server. To serve the React UI at port 3000 instead: `npm run build && npm start`.

## Environment variables

```dotenv
OPENWEATHER_API_KEY=YOUR_OPENWEATHER_KEY
GOOGLE_MAPS_SERVER_KEY=YOUR_GOOGLE_GEOCODING_SERVER_KEY
GOOGLE_MAPS_BROWSER_KEY=YOUR_GOOGLE_MAPS_JAVASCRIPT_BROWSER_KEY
AIRNOW_API_KEY=YOUR_EPA_AIRNOW_API_KEY
NASS_API_KEY=YOUR_OPTIONAL_USDA_NASS_KEY
PORT=3000
```

- **Google Maps JavaScript API**: use a browser key restricted to `http://localhost:5173/*`, `http://localhost:3000/*`, and the relevant published-domain referrer. Server-side geocoding is a separate restricted key. Browser Google key is intentionally returned to the React client; Google regards this as public and it **must** have website/API restrictions. Never expose server keys.
- **OpenWeather**: required for a live modeled smell risk, wind direction, weather and rain outlook.
- **EPA AirNow**: needed for the **measured US AQI**. Obtain at https://docs.airnowapi.org/. The code uses the 2026 *replacement* current-observations endpoint (`/aq/observation/current/ziplatlong/`), not the retired endpoint.
- **USGS stream measurements**: public service with no key required; individual sites may not have nitrate, dissolved oxygen or fresh readings. https://waterservices.usgs.gov/nwis/iv/
- **Iowa DNR**: public ArcGIS layer; no key required. https://services3.arcgis.com/kfmqp6kwSeDnDKNY/ArcGIS/rest/services/animal_feeding_operations/FeatureServer/0
- **Iowa Water Quality Information System (IWQIS)**: independent Iowa nitrate monitoring resource linked from the app, https://iwqis.iowawis.org/. The app currently fetches USGS measurements rather than scraping IWQIS.

Keep `.env` ignored by Git. `.env.example` contains placeholders only. If you accidentally committed a real key, revoke and rotate it, and remove it from unpushed Git history.

## Features

### 1. Stink map

The previous map now plots up to 80 nearest regulated facilities returned by Iowa DNR, a location marker, and a blue wind arrow based on OpenWeather's **wind-from** azimuth (arrow points *toward* where the wind carries air). Animal units are not literal pig counts. The optional translucent circles are illustrative source-area indicators, **not dispersion physics or measured odor concentrations**. A mapped livestock facility is **not** evidence of manure being applied, active odors, violations, or water contamination.

### 2. Air Quality vs. Stink Quality

The site displays **two different quantities**: modeled 0–100 odor-exposure index (uncalibrated) and the **measured AirNow reporting-area US AQI** (if AirNow key and observations are available). API responses include pollutant, category and reporting area. If absent or unavailable, the UI shows an empty/not-configured state — it does not manufacture AQI.

### 3. Water quality + rainfall

`GET /api/environment?lat=41.7434&lon=-92.7247` fetches USGS instantaneous stream values for a ~60 km search box over the **past seven days**: nitrate + nitrite as N (00631), nitrate as N (00618), dissolved oxygen (00300), pH (00400), water temperature (00010), discharge (00060), and precipitation at gauge (00045), only where real observations exist. It returns station names, approximate distances, units, raw measurement times, and provenance. "No reading" does **not** mean zero or safe.

OpenWeather's current last-hour rainfall and upcoming 3-hour precipitation samples add context for nutrient runoff. The app does NOT diagnose runoff, attribute nitrate to any particular farm, or certify drinking water safety. Observations may be delayed, and future forecasts can be incomplete near the end of their window.

### 4. Eco-farmer mini-game

React-only simulator where players choose surface broadcasting, incorporation, or subsurface injection and account for heavy rain, saturated soil, and stream buffers. It gives **designer-chosen game points**, *not measured odor/noise/nitrogen efficiency values*. Important tradeoffs, including tillage/soil disturbance, cost, ammonia retention and potential nitrous oxide impacts, are explained.

Sources:
- Iowa State Pork Information Gateway: https://www.porkgateway.iastate.edu/resource/swine-manure-and-land-application-practices-minimize-odors
- Iowa State Air Management Practices Assessment Tool: https://www.extension.iastate.edu/ampat/application-methods

## New/changed files

| Path | Purpose |
|---|---|
| `server/environment.js` | AirNow, USGS water data, rainfall context; injectable testable service |
| `server/index.js` | New `/api/environment` route |
| `server/config.js`, `.env.example` | AIRNOW_API_KEY configuration |
| `server/providers.js` | OpenWeather rain fields |
| `server/appService.js` | 100 closest facilities for map |
| `client/src/components/MapPanel.jsx` | Wind arrow and DNR facility markers |
| `client/src/components/EnvironmentPanel.jsx` | Stink vs. AQI and stream monitoring panels |
| `client/src/components/FarmingSimulator.jsx` | Mini-game |
| `client/src/App.jsx`, `api.js`, `styles.css` | Integration and pink styling |
| `tests/environment.test.js` | Air, water, precipitation and route tests |

## Tests

```bash
npm test
npm run build
```

At preparation time all **21 Node tests passed**. The React production build could not be run in the execution environment because npm dependencies could not be downloaded (an offline cache entry was unavailable). Run `npm run install:client && npm run build` locally. External API integration tests were run with stubs/mocks rather than live account credentials. Check the end-to-end display with your configured keys.
