const express = require("express");
const router = express.Router();

const { refreshToken } = require("../controllers/refreshTokenController");
const { checkAuthStatus } = require("../controllers/authStatusController");
const { logout } = require("../controllers/logoutController");
const { requestPasswordReset } = require("../controllers/requestPasswordReset");
const { resetPassword } = require("../controllers/resetPasswordController");

router.post("/refresh/token", refreshToken);

router.post("/check/status", checkAuthStatus);

router.post("/logout", logout);
router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);

module.exports = router;
