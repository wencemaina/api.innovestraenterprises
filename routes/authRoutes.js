const express = require("express");
const router = express.Router();

const { refreshToken } = require("../controllers/refreshTokenController");
const { checkAuthStatus } = require("../controllers/authStatusController");
const { logout } = require("../controllers/logoutController");

router.post("/refresh/token", refreshToken);

router.post("/check/status", checkAuthStatus);

router.post("/logout", logout);

module.exports = router;
