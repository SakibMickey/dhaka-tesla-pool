# Geography, Matching Rule & Fare Model

## 1. Zones (predefined list, no map API)

```
Banani, Gulshan 1, Gulshan 2, Mohakhali, Niketon,
Dhanmondi, Mohammadpur, Mirpur, Uttara, Farmgate, Bashundhara
```

Each zone has a fixed lat/long centroid (seeded in `zones` table) and belongs to one **cluster** — a group of zones close enough together that a driver can serve them on one pooled trip without a big detour.

```
Cluster A (Gulshan belt): Banani, Gulshan 1, Gulshan 2, Mohakhali, Niketon
Cluster B (Dhanmondi belt): Dhanmondi, Mohammadpur, Farmgate
Cluster C (North): Mirpur, Uttara
Cluster D (East): Bashundhara
```

A fixed distance-in-km lookup table between zone pairs is seeded (e.g. Banani↔Mohakhali = 3.0 km, Banani↔Gulshan 1 = 2.5 km) — this stands in for a real routing API.

## 2. Matching rule (documented assumption — Section 17)

Two open ride requests **R1** and **R2** can share a pool if **all** of the following hold:

1. Same pickup zone (`R1.pickup_zone == R2.pickup_zone`), **or** pickup zones in the same cluster and within 1.5 km of each other.
2. Destination zones are in the **same cluster**.
3. Combined `seats_requested` does not exceed the vehicle's remaining capacity.
4. `R2` is requested within a **5-minute window** of `R1` (or of the pool's creation) — so nobody waits indefinitely for a match.

**Why:** this is easy to test by hand, doesn't need real routing, and still reflects a real constraint (a driver shouldn't be sent 8 km out of the way to combine two rides).

**Worked example (Nusrat & Rafiq):** both pick up in Banani (same zone → rule 1 ✅). Mohakhali and Gulshan 1 are both in Cluster A (rule 2 ✅). 1 + 1 = 2 seats ≤ Bullet's 3 (rule 3 ✅). Rafiq requests 2 minutes after Nusrat (rule 4 ✅) → **they pool.**

**Shirin's case:** if Shirin requests a 3rd seat within the window and her destination is also Cluster A, she joins the same pool (3/3 seats — pool now `FULL`). If she requests a 4th seat, or her destination is a different cluster, she gets a new pool/vehicle instead.

## 3. Fare model

```
passengerFare = baseFare + distanceCharge - poolDiscount
```

| Component | Rule |
|---|---|
| `baseFare` | Flat 3000 poysha (৳30) per passenger |
| `distanceCharge` | `ratePerKm (1500 poysha/km) × distanceKm` (from the zone lookup table), per passenger's own pickup→destination distance |
| `poolDiscount` | 20% of `distanceCharge` **if and only if** the ride is part of a pool with ≥2 passengers, else 0 |

All amounts are stored and computed in **integer poysha** (1 taka = 100 poysha), never floating-point decimal — this avoids rounding drift across repeated fare math, which is a classic source of accounting bugs. Amounts are only converted to decimal taka (`poysha / 100`) at the presentation layer (API response / UI).

### Hand-calculated example

- Nusrat: Banani → Mohakhali = 3.0 km
  `distanceCharge = 1500 × 3.0 = 4500` poysha
  Pooled → `poolDiscount = 0.20 × 4500 = 900` poysha
  `fare = 3000 + 4500 − 900 = 6600` poysha = **৳66.00**

- Rafiq: Banani → Gulshan 1 = 2.5 km
  `distanceCharge = 1500 × 2.5 = 3750` poysha
  Pooled → `poolDiscount = 0.20 × 3750 = 750` poysha
  `fare = 3000 + 3750 − 750 = 6000` poysha = **৳60.00**

Each passenger only ever sees their own fare row (see `FARE` table in the ERD) — never anyone else's.

## 4. Payment

Two simulated methods, no real gateway:
- **Cash** — marked `PAID` when driver taps "trip completed" and confirms cash received.
- **TeslaPay** — a wallet balance on the `USER` row, debited atomically when the ride completes; insufficient balance blocks completion until the passenger tops up (simulated top-up endpoint).
