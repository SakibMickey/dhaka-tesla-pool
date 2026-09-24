const express = require("express");
const { signup, login, me } = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post("/signup", asyncHandler(signup));
router.post("/login", asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));

module.exports = router;
