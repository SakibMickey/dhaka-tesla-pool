const {
  MATCH_WINDOW_MINUTES,
  SAME_PICKUP_RADIUS_KM,
  MIN_DISTANCE_KM,
  sameCluster,
} = require("../config/zones");

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Straight-line (haversine) distance between two lat/lng points, in km.
// Stands in for a real routing API per docs/matching-and-fare.md.
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Looks up two zones by name and returns the distance between them in km,
// floored at MIN_DISTANCE_KM (a same-zone hop is still a billable minimum ride).
async function distanceBetweenZones(db, zoneAName, zoneBName) {
  if (zoneAName === zoneBName) return MIN_DISTANCE_KM;

  const [zoneA, zoneB] = await Promise.all([
    db.zone.findUnique({ where: { name: zoneAName } }),
    db.zone.findUnique({ where: { name: zoneBName } }),
  ]);

  if (!zoneA || !zoneB) {
    throw new Error(`Unknown zone: ${!zoneA ? zoneAName : zoneBName}`);
  }

  const km = haversineKm(zoneA.lat, zoneA.lng, zoneB.lat, zoneB.lng);
  return Math.max(km, MIN_DISTANCE_KM);
}

// Rule 1: same pickup zone, or same cluster + close enough (SAME_PICKUP_RADIUS_KM).
async function pickupsCompatible(db, zoneA, zoneB) {
  if (zoneA === zoneB) return true;
  if (!sameCluster(zoneA, zoneB)) return false;
  const distanceKm = await distanceBetweenZones(db, zoneA, zoneB);
  return distanceKm <= SAME_PICKUP_RADIUS_KM;
}

// Finds an OPEN pool this new request could join: same-ish pickup, destination
// in the same cluster as every existing member, enough remaining seats, and
// within the matching time window. Returns null if nothing fits (caller then
// waits for a driver to accept the request directly and start a new pool).
async function findCompatiblePool(db, { pickupZone, destinationZone, seatsRequested }) {
  const windowStart = new Date(Date.now() - MATCH_WINDOW_MINUTES * 60 * 1000);

  const candidatePools = await db.pool.findMany({
    where: { status: "OPEN", createdAt: { gte: windowStart } },
    include: { vehicle: true, rideRequests: true },
    orderBy: { createdAt: "asc" },
  });

  for (const pool of candidatePools) {
    const remainingSeats = pool.vehicle.capacity - pool.seatsOccupied;
    if (remainingSeats < seatsRequested) continue;

    // eslint-disable-next-line no-await-in-loop
    const pickupOk = await pickupsCompatible(db, pool.pickupZone, pickupZone);
    if (!pickupOk) continue;

    const destinationOk = pool.rideRequests
      .filter((r) => r.status !== "CANCELLED")
      .every((r) => sameCluster(r.destinationZone, destinationZone));
    if (!destinationOk) continue;

    return pool;
  }

  return null;
}

module.exports = { haversineKm, distanceBetweenZones, pickupsCompatible, findCompatiblePool };
