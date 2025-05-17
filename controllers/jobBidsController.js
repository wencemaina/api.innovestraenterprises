const { getDb } = require("../db");
const { ObjectId } = require("mongodb");

exports.jobBids = async (req, res) => {
	try {
		console.log("🔄 Received job bids request", req.body);

		// Extract writer ID from cookies
		const writerId = req.cookies["YwAsmAN"];

		if (!writerId) {
			return res.status(401).json({
				success: false,
				message: "Writer not authenticated",
			});
		}

		// Extract bid information from request body
		const { jobId, jobTitle, bidAmount, deliveryDays, coverLetter } =
			req.body;

		// Validate required fields
		if (!jobId || !bidAmount || !deliveryDays) {
			return res.status(400).json({
				success: false,
				message: "Missing required bid information",
			});
		}

		// Create bid object with status and timestamp
		const bid = {
			jobId,
			jobTitle,
			bidAmount,
			deliveryDays,
			coverLetter,
			writerId,
			status: "pending", // Default status
			createdAt: new Date(),
		};

		// Get database connection and store bid
		const db = await getDb();
		const result = await db.collection("bids").insertOne(bid);

		// Create notification for the bid submission
		const notification = {
			type: "bid",
			title: "New Bid Submitted",
			description: `You have submitted a bid of $${bidAmount} for job: ${jobTitle}`,
			time: new Date(),
			read: false,
			writerId, // Include writer ID for filtering notifications
			jobId, // Include job ID for reference
			bidId: result.insertedId, // Include the bid ID for reference
			deliveryDays,
			createdAt: new Date(),
		};

		// Store notification in the notifications collection
		await db.collection("notifications").insertOne(notification);
		console.log("✅ Notification created for bid submission");

		// Send success response
		res.status(201).json({
			success: false,
			message: "Bid submitted successfully",
			bidId: result.insertedId,
		});
	} catch (error) {
		console.error("❌ Error submitting bid:", error);
		res.status(500).json({
			success: false,
			message: "Failed to submit bid",
		});
	}
};
