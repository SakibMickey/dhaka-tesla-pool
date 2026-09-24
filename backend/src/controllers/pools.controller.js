const { z } = require("zod");
const prisma = require("../utils/prisma");

// Ride lifecycle per the brief (Section 3):
// REQUESTED -> MATCHED -> DRIVER_ARRIVED -> STARTED -> COMPLETED (+ CANCELLED)
// A pool's rides move through these stages together, since they share one
// physical vehicle and trip.
const ALLOWED_TRANSITIONS = {
  MATCHED: ["DRIVER_ARRIVED"],
  DRIVER_ARRIVED: ["STARTED"],
  STARTED: ["COMPLETED"],
};

const POOL_STATUS_BY_RIDE_STATUS = {
  STARTED: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
};

const statusSchema = z.object({
  status: z.enum(["DRIVER_ARRIVED", "STARTED", "COMPLETED"]),
});

function apiError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// Driver advances the whole pool's trip stage in one call — every active
// (non-cancelled) ride in the pool moves together.
async function updateStatus(req, res) {
  const poolId = req.params.id;
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const nextStatus = parsed.data.status;

  try {
    await prisma.$transaction(async (tx) => {
      const pool = await tx.pool.findUnique({
        where: { id: poolId },
        include: { vehicle: true, rideRequests: true },
      });
      if (!pool) throw apiError("Pool not found", "NOT_FOUND");
      if (pool.vehicle.driverId !== req.user.userId) {
        throw apiError("This is not your pool", "FORBIDDEN");
      }

      const activeRides = pool.rideRequests.filter((r) => r.status !== "CANCELLED");
      if (activeRides.length === 0) {
        throw apiError("No active rides in this pool", "NO_ACTIVE_RIDES");
      }

      const currentStatus = activeRides[0].status;
      const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
      if (!allowedNext.includes(nextStatus)) {
        throw apiError(`Cannot move from ${currentStatus} to ${nextStatus}`, "INVALID_TRANSITION");
      }

      for (const ride of activeRides) {
        // eslint-disable-next-line no-await-in-loop
        await tx.rideRequest.update({ where: { id: ride.id }, data: { status: nextStatus } });
        // eslint-disable-next-line no-await-in-loop
        await tx.rideStatusLog.create({
          data: { rideRequestId: ride.id, fromStatus: currentStatus, toStatus: nextStatus },
        });
      }

      if (POOL_STATUS_BY_RIDE_STATUS[nextStatus]) {
        await tx.pool.update({
          where: { id: pool.id },
          data: { status: POOL_STATUS_BY_RIDE_STATUS[nextStatus] },
        });
      }

      // Completing a trip marks cash fares as paid; TeslaPay fares are
      // debited from the passenger's wallet balance.
      if (nextStatus === "COMPLETED") {
        for (const ride of activeRides) {
          // eslint-disable-next-line no-await-in-loop
          const fare = await tx.fare.findUnique({ where: { rideRequestId: ride.id } });
          if (!fare || fare.paymentStatus === "PAID") continue;

          if (fare.paymentMethod === "TESLAPAY") {
            // eslint-disable-next-line no-await-in-loop
            const passenger = await tx.user.findUnique({ where: { id: ride.passengerId } });
            if (passenger.walletPoysha < fare.totalFarePoysha) {
              throw apiError(
                `Passenger's TeslaPay balance is insufficient to complete this ride`,
                "INSUFFICIENT_BALANCE"
              );
            }
            // eslint-disable-next-line no-await-in-loop
            await tx.user.update({
              where: { id: ride.passengerId },
              data: { walletPoysha: { decrement: fare.totalFarePoysha } },
            });
          }
          // eslint-disable-next-line no-await-in-loop
          await tx.fare.update({ where: { id: fare.id }, data: { paymentStatus: "PAID" } });
        }
      }
    });

    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { rideRequests: { include: { fare: true } } },
    });
    return res.json({ pool });
  } catch (err) {
    const statusByCode = {
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      NO_ACTIVE_RIDES: 409,
      INVALID_TRANSITION: 409,
      INSUFFICIENT_BALANCE: 402,
    };
    if (err.code && statusByCode[err.code]) {
      return res.status(statusByCode[err.code]).json({ error: err.message });
    }
    throw err;
  }
}

// Driver's current active pool — who's assigned and what stage it's at
// (Section 3: "driver needs to see who's assigned to the ride and what stage it's at").
async function myActivePool(req, res) {
  const vehicle = await prisma.vehicle.findUnique({ where: { driverId: req.user.userId } });
  if (!vehicle) return res.status(404).json({ error: "Register a vehicle first" });

  const pool = await prisma.pool.findFirst({
    where: { vehicleId: vehicle.id, status: { in: ["OPEN", "FULL", "IN_PROGRESS"] } },
    include: {
      rideRequests: {
        where: { status: { not: "CANCELLED" } },
        include: { fare: true, passenger: { select: { name: true, phone: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ pool: pool || null });
}

module.exports = { updateStatus, myActivePool };
