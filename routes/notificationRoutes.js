const express = require("express");
const router = express.Router();

const {
	getWriterNotifications,
	getEmployerNotifications,
	markNotificationAsRead,
	markAllNotificationsAsRead,
	clearAllNotifications,
	deleteNotification,
} = require("../controllers/notificationsController");

router.get("/writer/all", getWriterNotifications);

router.get("/employer/all", getEmployerNotifications);

router.put("/:notificationId/read", markNotificationAsRead);

router.put("/read-all", markAllNotificationsAsRead);

router.delete("/clear-all", clearAllNotifications);

router.delete("/:id", deleteNotification);

module.exports = router;
