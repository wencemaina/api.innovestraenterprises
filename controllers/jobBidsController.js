const { getDb } = require("../db");

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

		// Send success response
		res.status(201).json({
			success: true,
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
