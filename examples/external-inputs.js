// Example input file. These values are entirely hypothetical, NOT an Iowa observation.
export const conditions = {
  receptor: { lat: 41.7434, lon: -92.7247 }, // Example point near Grinnell
  weather: { tempF: 57, humidity: 71, windMph: 5, windFromDeg: 270 },
  farms: [
    { id: 'sample-1', name: 'Fictional example farm', lat: 41.7434, lon: -92.7747,
      swineAnimalUnits: 750, totalAnimalUnits: 750, type: 'Example only' },
    { id: 'sample-2', name: 'Second fictional farm', lat: 41.7134, lon: -92.7547,
      swineAnimalUnits: 550, totalAnimalUnits: 550, type: 'Example only' }
  ],
  manureStatus: 'unknown',
  timestamp: '2026-11-21T18:00:00.000Z'
};
