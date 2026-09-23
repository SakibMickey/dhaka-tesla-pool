const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../utils/prisma");
const { signToken } = require("../utils/jwt");

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(6, "Phone number looks too short"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["PASSENGER", "DRIVER"]),
});

const loginSchema = z.object({
  phone: z.string().min(6, "Phone number looks too short"),
  password: z.string().min(1, "Password is required"),
});

function toPublicUser(user) {
  // Never send passwordHash back to the client.
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

async function signup(req, res) {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { name, phone, email, password, role } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ phone }, { email }] },
  });
  if (existing) {
    return res.status(409).json({ error: "Phone or email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, phone, email, passwordHash, role },
  });

  const token = signToken(user);
  return res.status(201).json({ user: toPublicUser(user), token });
}

async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { phone, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return res.status(401).json({ error: "Invalid phone or password" });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid phone or password" });
  }

  const token = signToken(user);
  return res.json({ user: toPublicUser(user), token });
}

async function me(req, res) {
  // req.user is set by the requireAuth middleware
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json({ user: toPublicUser(user) });
}

module.exports = { signup, login, me };
