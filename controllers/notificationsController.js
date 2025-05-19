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
