require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Health check - used by docker-compose / deployment platform
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "dhaka-tesla-pool-backend" });
});

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/vehicles", require("./routes/vehicles.routes"));
app.use("/api/rides", require("./routes/rides.routes"));
app.use("/api/pools", require("./routes/pools.routes"));

// Catches errors thrown/rejected inside any asyncHandler-wrapped controller.
// Must be registered after all routes.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Dhaka Tesla Pool API listening on port ${PORT}`);
});

module.exports = app;
