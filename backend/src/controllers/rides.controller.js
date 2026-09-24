const { z } = require("zod");
const prisma = require("../utils/prisma");
const { CLUSTERS } = require("../config/zones");
const { findCompatiblePool, distanceBetweenZones } = require("../services/matching.service");
const { calculateFare } = require("../services/fare.service");

const ZONE_NAMES = Object.keys(CLUSTERS);
const CANCELLABLE_STATUSES = ["REQUESTED", "MATCHED", "DRIVER_ARRIVED"];

const createRideSchema = z
  .object({
    pickupZone: z.enum(ZONE_NAMES),
    destinationZone: z.enum(ZONE_NAMES),
    seatsRequested: z.number().int().min(1).max(3).default(1),
  })
  .refine((data) => data.pickupZone !== data.destinationZone, {
    message: "Pickup and destination must be different zones",
    path: ["destinationZone"],
  });

function apiError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// Recomputes and upserts Fare rows for every active ride in a pool. Called
// whenever pool membership changes, since the pool discount (docs/matching-and-fare.md)
// depends on how many passengers currently share the ride.
async function recomputePoolFares(tx, poolId) {
  const activeRides = await tx.rideRequest.findMany({
    where: { poolId, status: { notIn: ["CANCELLED"] } },
  });
  const isPooled = activeRides.length >= 2;

  for (const ride of activeRides) {
    // eslint-disable-next-line no-await-in-loop
    const distanceKm = await distanceBetweenZones(tx, ride.pickupZone, ride.destinationZone);
    const fare = calculateFare(distanceKm, isPooled);
    // eslint-disable-next-line no-await-in-loop
    await tx.fare.upsert({
      where: { rideRequestId: ride.id },
      update: fare,
      create: { rideRequestId: ride.id, ...fare },
    });
  }
}

// Locks the pool row (FOR UPDATE), re-checks capacity against the locked value,
// then assigns the ride. This is what makes the last-seat race in
// docs/concurrency.md safe: a second concurrent caller blocks on the lock and
// re-reads a fresh seatsOccupied once the first transaction commits.
async function assignRideToPool(tx, { ride, pool, vehicleCapacity }) {
  await tx.$executeRaw`SELECT id FROM "Pool" WHERE id = ${pool.id} FOR UPDATE`;
  const freshPool = await tx.pool.findUnique({ where: { id: pool.id } });

  if (freshPool.status !== "OPEN") {
    throw apiError("Pool is no longer open", "POOL_CLOSED");
  }
  if (freshPool.seatsOccupied + ride.seatsRequested > vehicleCapacity) {
    throw apiError("Not enough seats left in this pool", "POOL_FULL");
  }

  const newSeatsOccupied = freshPool.seatsOccupied + ride.seatsRequested;
  await tx.pool.update({
    where: { id: pool.id },
    data: {
      seatsOccupied: newSeatsOccupied,
      status: newSeatsOccupied >= vehicleCapacity ? "FULL" : "OPEN",
    },
  });

  await tx.rideRequest.update({
    where: { id: ride.id },
    data: { poolId: pool.id, status: "MATCHED" },
  });
  await tx.rideStatusLog.create({
    data: { rideRequestId: ride.id, fromStatus: "REQUESTED", toStatus: "MATCHED" },
  });

  await recomputePoolFares(tx, pool.id);
}

// Passenger requests a ride. We try to auto-match into an existing compatible
// pool immediately; if nothing fits, the request just waits as REQUESTED for
// a driver to accept it directly (see acceptRide).
async function createRide(req, res) {
  const parsed = createRideSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { pickupZone, destinationZone, seatsRequested } = parsed.data;

  const ride = await prisma.rideRequest.create({
    data: {
      passengerId: req.user.userId,
      pickupZone,
      destinationZone,
      seatsRequested,
      status: "REQUESTED",
    },
  });
  await prisma.rideStatusLog.create({
    data: { rideRequestId: ride.id, fromStatus: "NONE", toStatus: "REQUESTED" },
  });

  const compatiblePool = await findCompatiblePool(prisma, {
    pickupZone,
    destinationZone,
    seatsRequested,
  });

  if (compatiblePool) {
    try {
      await prisma.$transaction((tx) =>
        assignRideToPool(tx, {
          ride,
          pool: compatiblePool,
          vehicleCapacity: compatiblePool.vehicle.capacity,
        })
      );
    } catch (err) {
      // Someone else took the seat between our check and the lock — the ride
      // just stays REQUESTED, waiting for a driver to accept it directly.
      if (err.code !== "POOL_FULL" && err.code !== "POOL_CLOSED") throw err;
    }
  }

  const finalRide = await prisma.rideRequest.findUnique({
    where: { id: ride.id },
    include: { fare: true },
  });

  if (finalRide.status === "REQUESTED") {
    const distanceKm = await distanceBetweenZones(prisma, pickupZone, destinationZone);
    const estimatedFare = calculateFare(distanceKm, false);
    return res.status(201).json({ ride: finalRide, estimatedFare, matched: false });
  }

  return res.status(201).json({ ride: finalRide, matched: true });
}

// Driver browses currently unmatched requests.
async function listAvailable(req, res) {
  const vehicle = await prisma.vehicle.findUnique({ where: { driverId: req.user.userId } });
  if (!vehicle) return res.status(404).json({ error: "Register a vehicle first" });
  if (vehicle.status !== "ONLINE") {
    return res.status(400).json({ error: "Go online to see ride requests" });
  }

  const rides = await prisma.rideRequest.findMany({
    where: { status: "REQUESTED" },
    orderBy: { requestedAt: "asc" },
    include: { passenger: { select: { name: true, phone: true } } },
  });
  return res.json({ rides });
}

// Driver accepts a specific request, joining or starting their own pool.
async function acceptRide(req, res) {
  const rideId = req.params.id;

  try {
    const poolId = await prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({ where: { driverId: req.user.userId } });
      if (!vehicle) throw apiError("Register a vehicle first", "NO_VEHICLE");
      if (vehicle.status !== "ONLINE") throw apiError("Go online first", "OFFLINE");

      const ride = await tx.rideRequest.findUnique({ where: { id: rideId } });
      if (!ride || ride.status !== "REQUESTED") {
        throw apiError("This ride is no longer available", "NOT_AVAILABLE");
      }

      let pool = await tx.pool.findFirst({ where: { vehicleId: vehicle.id, status: "OPEN" } });
      if (!pool) {
        pool = await tx.pool.create({
          data: {
            vehicleId: vehicle.id,
            pickupZone: ride.pickupZone,
            status: "OPEN",
            seatsOccupied: 0,
          },
        });
      }

      await assignRideToPool(tx, { ride, pool, vehicleCapacity: vehicle.capacity });
      return pool.id;
    });

    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { rideRequests: { include: { fare: true } }, vehicle: true },
    });
    return res.json({ pool });
  } catch (err) {
    const statusByCode = {
      NO_VEHICLE: 404,
      OFFLINE: 400,
      NOT_AVAILABLE: 409,
      POOL_FULL: 409,
      POOL_CLOSED: 409,
    };
    if (err.code && statusByCode[err.code]) {
      return res.status(statusByCode[err.code]).json({ error: err.message });
    }
    throw err;
  }
}

// Passenger cancels their own ride, while it's still in a cancellable state.
async function cancelRide(req, res) {
  const rideId = req.params.id;

  try {
    await prisma.$transaction(async (tx) => {
      const ride = await tx.rideRequest.findUnique({ where: { id: rideId } });
      if (!ride) throw apiError("Ride not found", "NOT_FOUND");
      if (ride.passengerId !== req.user.userId) {
        throw apiError("You can only cancel your own ride", "FORBIDDEN");
      }
      if (!CANCELLABLE_STATUSES.includes(ride.status)) {
        throw apiError(`Cannot cancel a ride that is ${ride.status}`, "INVALID_STATE");
      }

      const fromStatus = ride.status;
      await tx.rideRequest.update({ where: { id: ride.id }, data: { status: "CANCELLED" } });
      await tx.rideStatusLog.create({
        data: { rideRequestId: ride.id, fromStatus, toStatus: "CANCELLED" },
      });

      if (ride.poolId) {
        await tx.$executeRaw`SELECT id FROM "Pool" WHERE id = ${ride.poolId} FOR UPDATE`;
        const pool = await tx.pool.findUnique({ where: { id: ride.poolId } });
        const newSeatsOccupied = Math.max(0, pool.seatsOccupied - ride.seatsRequested);
        await tx.pool.update({
          where: { id: pool.id },
          data: {
            seatsOccupied: newSeatsOccupied,
            status: pool.status === "FULL" ? "OPEN" : pool.status,
          },
        });
        await recomputePoolFares(tx, pool.id);
      }
    });

    return res.json({ cancelled: true });
  } catch (err) {
    const statusByCode = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATE: 409 };
    if (err.code && statusByCode[err.code]) {
      return res.status(statusByCode[err.code]).json({ error: err.message });
    }
    throw err;
  }
}

// Passenger's own ride history — never anyone else's (Section 2 of the brief).
async function myRides(req, res) {
  const rides = await prisma.rideRequest.findMany({
    where: { passengerId: req.user.userId },
    orderBy: { requestedAt: "desc" },
    include: { fare: true, pool: { select: { id: true, status: true } } },
  });
  return res.json({ rides });
}

module.exports = { createRide, listAvailable, acceptRide, cancelRide, myRides };
