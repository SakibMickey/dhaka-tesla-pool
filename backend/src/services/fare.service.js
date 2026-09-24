// Implements: passengerFare = baseFare + distanceCharge - poolDiscount
// All amounts in integer poysha (1 taka = 100 poysha) — never floating decimal,
// see docs/matching-and-fare.md for why.

const BASE_FARE_POYSHA = 3000; // ৳30 flat per passenger
const RATE_PER_KM_POYSHA = 1500; // ৳15/km
const POOL_DISCOUNT_RATE = 0.2; // 20% off distanceCharge when pooled

function calculateFare(distanceKm, isPooled) {
  const distanceChargePoysha = Math.round(RATE_PER_KM_POYSHA * distanceKm);
  const poolDiscountPoysha = isPooled
    ? Math.round(POOL_DISCOUNT_RATE * distanceChargePoysha)
    : 0;
  const totalFarePoysha = BASE_FARE_POYSHA + distanceChargePoysha - poolDiscountPoysha;

  return {
    baseFarePoysha: BASE_FARE_POYSHA,
    distanceChargePoysha,
    poolDiscountPoysha,
    totalFarePoysha,
  };
}

module.exports = { calculateFare, BASE_FARE_POYSHA, RATE_PER_KM_POYSHA, POOL_DISCOUNT_RATE };
