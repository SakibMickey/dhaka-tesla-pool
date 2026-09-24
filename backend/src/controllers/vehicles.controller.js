const { z } = require("zod");
const prisma = require("../utils/prisma");

const registerSchema = z.object({
  label: z.string().min(1, "Vehicle label is required"),
  capacity: z.number().int().positive("Capacity must be a positive integer"),
});

const statusSchema = z.object({
  status: z.enum(["ONLINE", "OFFLINE"]),
});

// A driver registers their vehicle once (Section 3: "own a Tesla with fixed capacity").
async function registerVehicle(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await prisma.vehicle.findUnique({ where: { driverId: req.user.userId } });
  if (existing) {
    return res.status(409).json({ error: "This driver already has a registered vehicle" });
  }

  const vehicle = await prisma.vehicle.create({
    data: { ...parsed.data, driverId: req.user.userId },
  });
  return res.status(201).json({ vehicle });
}

async function setStatus(req, res) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { driverId: req.user.userId } });
  if (!vehicle) {
    return res.status(404).json({ error: "Register a vehicle first" });
  }

  const updated = await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: { status: parsed.data.status },
  });
  return res.json({ vehicle: updated });
}

async function myVehicle(req, res) {
  const vehicle = await prisma.vehicle.findUnique({ where: { driverId: req.user.userId } });
  if (!vehicle) {
    return res.status(404).json({ error: "No vehicle registered yet" });
  }
  return res.json({ vehicle });
}

module.exports = { registerVehicle, setStatus, myVehicle };
