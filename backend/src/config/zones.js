// Static config backing the matching rule documented in docs/matching-and-fare.md.
// Zones are grouped into clusters (areas close enough to serve on one pooled trip).

const CLUSTERS = {
  "Banani": "A",
  "Gulshan 1": "A",
  "Gulshan 2": "A",
  "Mohakhali": "A",
  "Niketon": "A",
  "Dhanmondi": "B",
  "Mohammadpur": "B",
  "Farmgate": "B",
  "Mirpur": "C",
  "Uttara": "C",
  "Bashundhara": "D",
};

// Requests must be within this many minutes of each other to be pooled.
const MATCH_WINDOW_MINUTES = 5;

// Two pickup points count as "the same pickup" if they're within this radius.
const SAME_PICKUP_RADIUS_KM = 1.5;

// Minimum billable distance for a trip (covers same-zone hops), per the
// documented fare assumption.
const MIN_DISTANCE_KM = 1.0;

function clusterOf(zoneName) {
  return CLUSTERS[zoneName] || null;
}

function sameCluster(zoneA, zoneB) {
  const clusterA = clusterOf(zoneA);
  const clusterB = clusterOf(zoneB);
  return Boolean(clusterA) && clusterA === clusterB;
}

module.exports = {
  CLUSTERS,
  MATCH_WINDOW_MINUTES,
  SAME_PICKUP_RADIUS_KM,
  MIN_DISTANCE_KM,
  clusterOf,
  sameCluster,
};
