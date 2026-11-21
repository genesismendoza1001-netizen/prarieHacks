const toRad = degrees => degrees * Math.PI / 180;
const toDeg = radians => radians * 180 / Math.PI;

export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export function normalizeDegrees(degrees) { return ((degrees % 360) + 360) % 360; }
export function deltaDegrees(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}
export function validIowaCoordinate(lat, lon) {
  // Loose bounding rectangle, not a substitute for official state-boundary data.
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= 40.35 && lat <= 43.55 && lon >= -96.7 && lon <= -90.1;
}
export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(Math.max(0, 1 - s)));
}
export function bearingDegrees(from, to) {
  const latitude1 = toRad(from.lat), latitude2 = toRad(to.lat);
  const dLon = toRad(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(latitude2);
  const x = Math.cos(latitude1) * Math.sin(latitude2) - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(dLon);
  return normalizeDegrees(toDeg(Math.atan2(y, x)));
}
export function searchEnvelope(lat, lon, radiusKm) {
  const dy = radiusKm / 111.2;
  const dx = radiusKm / (111.2 * Math.max(0.15, Math.cos(toRad(lat))));
  return { xmin: lon - dx, ymin: lat - dy, xmax: lon + dx, ymax: lat + dy, spatialReference: { wkid: 4326 } };
}
