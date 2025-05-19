const express = require("express");
const router = express.Router();

const {
	getWriterNotifications,
	getEmployerNotifications,
} = require("../controllers/notificationsController");

router.get("/writer/all", getWriterNotifications);

router.get("/employer/all", getEmployerNotifications);

module.exports = router;
