// Seed data using the brief's story cast: Jashim (driver), Bullet (vehicle),
// Nusrat, Rafiq, Shirin (passengers). Do not replace with generic user1/driver1.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const ZONES = [
  { name: "Banani", lat: 23.7937, lng: 90.4066 },
  { name: "Gulshan 1", lat: 23.7808, lng: 90.4147 },
  { name: "Gulshan 2", lat: 23.7925, lng: 90.4078 },
  { name: "Mohakhali", lat: 23.7806, lng: 90.4023 },
  { name: "Niketon", lat: 23.7897, lng: 90.4165 },
  { name: "Dhanmondi", lat: 23.7461, lng: 90.3742 },
  { name: "Mohammadpur", lat: 23.7656, lng: 90.3588 },
  { name: "Mirpur", lat: 23.8223, lng: 90.3654 },
  { name: "Uttara", lat: 23.8759, lng: 90.3795 },
  { name: "Farmgate", lat: 23.7581, lng: 90.3897 },
  { name: "Bashundhara", lat: 23.8145, lng: 90.4294 },
];

const ZONE_DISTANCES = [
  { fromZone: "Banani", toZone: "Mohakhali", distanceKm: 3.0 },
  { fromZone: "Banani", toZone: "Gulshan 1", distanceKm: 2.5 },
  { fromZone: "Banani", toZone: "Gulshan 2", distanceKm: 1.5 },
];

async function main() {
  await prisma.zone.createMany({ data: ZONES, skipDuplicates: true });
  await prisma.zoneDistance.createMany({ data: ZONE_DISTANCES, skipDuplicates: true });

  const passwordHash = await bcrypt.hash("password123", 10);

  const jashim = await prisma.user.upsert({
    where: { phone: "01711000001" },
    update: {},
    create: {
      name: "Jashim",
      phone: "01711000001",
      email: "jashim@dhakateslapool.local",
      passwordHash,
      role: "DRIVER",
    },
  });

  await prisma.vehicle.upsert({
    where: { driverId: jashim.id },
    update: {},
    create: {
      driverId: jashim.id,
      label: "Bullet",
      capacity: 3,
      status: "ONLINE",
    },
  });

  const passengers = [
    { name: "Nusrat", phone: "01711000002" },
    { name: "Rafiq", phone: "01711000003" },
    { name: "Shirin", phone: "01711000004" },
  ];

  for (const p of passengers) {
    await prisma.user.upsert({
      where: { phone: p.phone },
      update: {},
      create: {
        name: p.name,
        phone: p.phone,
        email: `${p.name.toLowerCase()}@dhakateslapool.local`,
        passwordHash,
        role: "PASSENGER",
        walletPoysha: 50000, // ৳500 TeslaPay starting balance for demo
      },
    });
  }

  console.log("Seed complete: Jashim/Bullet + Nusrat/Rafiq/Shirin ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
