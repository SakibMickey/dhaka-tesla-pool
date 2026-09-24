const express = require("express");
const { registerVehicle, setStatus, myVehicle } = require("../controllers/vehicles.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(requireAuth, requireRole("DRIVER"));

router.post("/", asyncHandler(registerVehicle));
router.patch("/status", asyncHandler(setStatus));
router.get("/me", asyncHandler(myVehicle));

module.exports = router;
