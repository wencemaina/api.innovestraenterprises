const { getDb } = require("../db");

exports.getWriterNotifications = async (req, res) => {
	try {
		console.log("🔄 Received request to get all notifications");
		const writerId = req.cookies["YwAsmAN"];
		if (!writerId) {
			return res
				.status(400)
				.json({ message: "User ID not found in cookies." });
		}

		const db = await getDb();
		const notifications = await db
			.collection("notifications")
			.find({ writerId }) // Changed from userId to writerId to match your data structure
			.sort({ createdAt: -1 }) // Sort by newest first
			.toArray();

		res.status(200).json(notifications);
	} catch (error) {
		console.error("Error fetching notifications:", error);
		res.status(500).json({ message: "Internal server error." });
	}
};

exports.getEmployerNotifications = async (req, res) => {
	try {
		console.log("🔄 Received request to get all notifications");
		const employerId = req.cookies["YwAsmAN"];
		if (!employerId) {
			return res
				.status(400)
				.json({ message: "User ID not found in cookies." });
		}

		const db = await getDb();
		const notifications = await db
			.collection("notifications")
			.find({ employerId }) // Changed from userId to writerId to match your data structure
			.sort({ createdAt: -1 }) // Sort by newest first
			.toArray();

		res.status(200).json(notifications);
	} catch (error) {
		console.error("Error fetching notifications:", error);
		res.status(500).json({ message: "Internal server error." });
	}
};

/**
 * Marks a notification as read
 * @route PUT /api/notifications/:notificationId/read
 */
exports.markNotificationAsRead = async (req, res) => {
	try {
		console.log("🔄 Marking notification as read");

		// Get notification ID from params
		const { notificationId } = req.params;
		console.log("Notification ID:", notificationId);

		if (!notificationId) {
			return res
				.status(400)
				.json({ message: "Notification ID is required." });
		}

		// Get user ID from cookies to ensure user can only mark their own notifications
		const userId = req.cookies["YwAsmAN"];

		if (!userId) {
			return res
				.status(400)
				.json({ message: "User ID not found in cookies." });
		}

		const db = await getDb();

		// Find the notification first to check if it belongs to the user
		const notification = await db
			.collection("notifications")
			.findOne({ id: notificationId });

		if (!notification) {
			return res.status(404).json({ message: "Notification not found." });
		}

		// Check if the notification belongs to this user (either as writer or employer)
		if (
			notification.writerId !== userId &&
			notification.employerId !== userId
		) {
			return res.status(403).json({
				message:
					"You are not authorized to mark this notification as read.",
			});
		}

		// Update the notification to mark it as read
		const result = await db
			.collection("notifications")
			.updateOne({ id: notificationId }, { $set: { isRead: true } });

		if (result.modifiedCount === 0) {
			return res
				.status(404)
				.json({ message: "Failed to mark notification as read." });
		}

		res.status(200).json({
			success: true,
			message: "Notification marked as read.",
		});
	} catch (error) {
		console.error("Error marking notification as read:", error);
		res.status(500).json({ message: "Internal server error." });
	}
};

/**
 * Marks all notifications as read for a user (writer or employer)
 * @route PUT /api/notifications/read-all
 */
exports.markAllNotificationsAsRead = async (req, res) => {
	try {
		console.log("🔄 Marking all notifications as read");

		// Get user ID from cookies
		const userId = req.cookies["YwAsmAN"];

		if (!userId) {
			return res
				.status(400)
				.json({ message: "User ID not found in cookies." });
		}

		const db = await getDb();

		// Create a query that matches notifications for this user either as writer or employer
		const query = {
			$or: [{ writerId: userId }, { employerId: userId }],
			isRead: false, // Only update unread notifications
		};

		// Update all matching notifications
		const result = await db
			.collection("notifications")
			.updateMany(query, { $set: { isRead: true } });

		res.status(200).json({
			success: true,
			message: `${result.modifiedCount} notifications marked as read.`,
		});
	} catch (error) {
		console.error("Error marking all notifications as read:", error);
		res.status(500).json({ message: "Internal server error." });
	}
};

exports.clearAllNotifications = async (req, res) => {
	try {
		console.log("🗑️ Clearing all notifications");

		// Get user ID from cookies
		const userId = req.cookies["YwAsmAN"];

		if (!userId) {
			return res
				.status(400)
				.json({ message: "User ID not found in cookies." });
		}

		const db = await getDb();

		// Create a query that matches notifications for this user either as writer or employer
		const query = {
			$or: [{ writerId: userId }, { employerId: userId }],
		};

		// Delete all matching notifications
		const result = await db.collection("notifications").deleteMany(query);

		res.status(200).json({
			success: true,
			message: `${result.deletedCount} notifications cleared successfully.`,
		});
	} catch (error) {
		console.error("Error clearing notifications:", error);
		res.status(500).json({ message: "Internal server error." });
	}
};

/**
 * Deletes a single notification by ID
 * @route DELETE /api/notifications/:notificationId
 */
exports.deleteNotification = async (req, res) => {
	try {
		console.log("🗑️ Deleting notification");

		// Get notification ID from params and rename it
		const { id: notificationId } = req.params;

		if (!notificationId) {
			return res
				.status(400)
				.json({ message: "Notification ID is required." });
		}

		// Get user ID from cookies to ensure user can only delete their own notifications
		const userId = req.cookies["YwAsmAN"];

		if (!userId) {
			return res
				.status(400)
				.json({ message: "User ID not found in cookies." });
		}

		const db = await getDb();

		// Find the notification first to check if it belongs to the user
		const notification = await db
			.collection("notifications")
			.findOne({ id: notificationId });

		if (!notification) {
			return res.status(404).json({ message: "Notification not found." });
		}

		// Check if the notification belongs to this user
		if (
			notification.writerId !== userId &&
			notification.employerId !== userId
		) {
			return res
				.status(403)
				.json({
					message:
						"You are not authorized to delete this notification.",
				});
		}

		// Delete the notification
		const result = await db
			.collection("notifications")
			.deleteOne({ id: notificationId });

		if (result.deletedCount === 0) {
			return res
				.status(404)
				.json({ message: "Failed to delete notification." });
		}

		res.status(200).json({
			success: true,
			message: "Notification deleted successfully.",
		});
	} catch (error) {
		console.error("Error deleting notification:", error);
		res.status(500).json({ message: "Internal server error." });
	}
};
