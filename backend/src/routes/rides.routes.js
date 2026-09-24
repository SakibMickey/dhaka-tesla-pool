const express = require("express");
const { createRide, listAvailable, acceptRide, cancelRide, myRides } = require("../controllers/rides.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(requireAuth);

router.post("/", requireRole("PASSENGER"), asyncHandler(createRide));
router.get("/mine", requireRole("PASSENGER"), asyncHandler(myRides));
router.post("/:id/cancel", requireRole("PASSENGER"), asyncHandler(cancelRide));

router.get("/available", requireRole("DRIVER"), asyncHandler(listAvailable));
router.post("/:id/accept", requireRole("DRIVER"), asyncHandler(acceptRide));

module.exports = router;
