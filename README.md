# prarieHacks
GrinnSmell combines real-time meteorological data from OpenWeather, regulated livestock facility locations from the Iowa Department of Natural Resources, air quality observations from EPA AirNow, water quality measurements from USGS, and agricultural statistics from USDA NASS. An experimental geographic and weather-based model estimates manure-odor risk. Environmental education features are informed by Iowa State University research and Iowa DNR publications. Predictions are informational estimates and have not been validated as measured odor probabilities.

# GrinSmell — corrected runnable React project

This version fixes filenames accidentally saved with ` (1)` and fixes the Node server's static-file path. **You do not need to use any real credentials to see the pink dashboard.** Live data requires API keys in a local `.env` file.

## 1. Configure (optional for visual startup)

Copy `.env.example` to `.env` alongside the root `package.json` and add your actual keys to `.env` only. Never commit `.env`. No API keys are included in this ZIP.

## 2. Development (two terminals, from the project root)

```sh
npm run install:client
npm run dev:server
```

In a **second terminal**:

```sh
npm run dev:client
```

Open **http://localhost:5173/** for the React app. Check **http://localhost:3000/api/health** for the backend.

## 3. Build and serve on one port

```sh
npm run build
npm start
```

Open **http://localhost:3000/**. The backend serves `client/dist/` if built. Otherwise, it falls back to the earlier vanilla JavaScript UI from `app/`.

## 4. Tests

```sh
npm test
```

## Fixes relative to the uploaded ZIP

- `client/index (1).html` -> `client/index.html`
- `client/src/main (1).jsx` -> `client/src/main.jsx`
- `client/src/api (1).js` -> `client/src/api.js`
- `client/src/styles (1).css` -> `client/src/styles.css`
- `client/src/components/MapPanel (1).jsx` -> `client/src/components/MapPanel.jsx`
- `server/index.js` now serves built React assets or the existing `app/` fallback; it no longer points at a nonexistent `public/`.

Additional details: `REACT-SETUP.md`. Smell risk values are **heuristic indices**, not validated odor probabilities.

## New environmental dashboard and farm mini-game

**See [ECO-FEATURES.md](ECO-FEATURES.md)** for the expanded setup, API credentials, source links, AirNow and USGS behavior, wind map, and simulator limitations.

A separate `AIRNOW_API_KEY` in `.env` enables measured US AQI. USGS stream measurements need no additional key; observations are shown only if available. Live mapped animal feeding operations remain from Iowa DNR and the wind arrow uses OpenWeather data.

## Sources Used
1. OpenWeather API
https://openweathermap.org/api

2. Google Maps Geocoding API
https://developers.google.com/maps/documentation/geocoding

3. Google Maps JavaScript API
https://developers.google.com/maps/documentation/javascript

4. Iowa DNR Animal Feeding Operations GIS
https://services3.arcgis.com/kfmqp6kwSeDnDKNY/ArcGIS/rest/services/animal_feeding_operations/FeatureServer/0

5. EPA AirNow API
https://docs.airnowapi.org/

6. USGS Water Services
https://waterservices.usgs.gov/nwis/iv/

7. USDA NASS Quick Stats API
https://quickstats.nass.usda.gov/


SCIENTIFIC RESEARCH & ENVIRONMENTAL REFERENCES

8. Iowa State University — Swine Manure and Land Application Practices to Minimize Odors
https://www.porkgateway.iastate.edu/resource/swine-manure-and-land-application-practices-minimize-odors

9. Iowa State University — Air Management Practices Assessment Tool
https://www.extension.iastate.edu/ampat/application-methods

10. Iowa DNR — Animal Feeding Operations Odor Study
https://www.iowadnr.gov/media/2319/download?inline=

11. USDA NASS — Quarterly Hogs and Pigs (September 2026)
https://data.nass.usda.gov/Newsroom/2026/09-24-2026.php

12. Iowa Economic Development & Finance Authority — Advanced Manufacturing
https://opportunityiowa.gov/business/iowa-advantage/key-industries/advanced-manufacturing

13. Iowa Department of Agriculture — Crop Progress Report
https://iowaagriculture.gov/news/crop-progress-report-11-15-2026

14. Iowa DNR — AFO Online Services
https://www.iowadnr.gov/environmental-protection/animal-feeding-operations/afo-online-services

15. Iowa Water Quality Information System (IWQIS)
https://iwqis.iowawis.org/


DEVELOPMENT TECHNOLOGIES

16. React
https://react.dev/

17. Vite
https://vite.dev/

18. Node.js
https://nodejs.org/

19. Google Maps Platform
https://developers.google.com/maps

20. Browser Geolocation API
https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API