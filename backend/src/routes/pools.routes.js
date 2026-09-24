const express = require("express");
const { updateStatus, myActivePool } = require("../controllers/pools.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.use(requireAuth, requireRole("DRIVER"));

router.get("/mine", asyncHandler(myActivePool));
router.patch("/:id/status", asyncHandler(updateStatus));

module.exports = router;
