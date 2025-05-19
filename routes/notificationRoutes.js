const express = require("express");
const router = express.Router();

const {
	getAllNotifications,
} = require("../controllers/getAllNotificationsController");

router.get("/all", getAllNotifications);

module.exports = router;
