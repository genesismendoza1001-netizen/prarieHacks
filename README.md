# prarieHacks

# Piggy Forecast — corrected runnable React project

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
