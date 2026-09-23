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

// Route modules are added feature-by-feature on their own branches:
// app.use("/api/rides", require("./routes/rides.routes"));
// app.use("/api/drivers", require("./routes/drivers.routes"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Dhaka Tesla Pool API listening on port ${PORT}`);
});

module.exports = app;
