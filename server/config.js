export const CONFIG = Object.freeze({
  port: Number(process.env.PORT || 3000),
  openWeatherKey: process.env.OPENWEATHER_API_KEY || '',
  googleServerKey: process.env.GOOGLE_MAPS_SERVER_KEY || '',
  googleBrowserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || '',
  nassKey: process.env.NASS_API_KEY || '',
  dnrLayerUrl: 'https://services3.arcgis.com/kfmqp6kwSeDnDKNY/ArcGIS/rest/services/animal_feeding_operations/FeatureServer/0',
  searchRadiusKm: 30,
  timeZone: 'America/Chicago'
});
