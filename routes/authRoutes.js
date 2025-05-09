const express = require("express");
const router = express.Router();

const { refreshToken } = require("../controllers/refreshTokenController");
const { checkAuthStatus } = require("../controllers/checkAuthStatusController");

router.post("/refresh/token", refreshToken);

router.post("/check/status", checkAuthStatus);

module.exports = router;
