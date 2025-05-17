const { getDb } = require("../db");

exports.checkJobBid = async (req, res) => {
	try {
		console.log("🔄 Received request to check job bids", req.params);

		// Extract writer ID from cookies
		const writerId = req.cookies["YwAsmAN"];

		if (!writerId) {
			return res.status(401).json({
				success: false,
				message: "Writer not authenticated",
			});
		}

		// Extract job ID from URL parameters
		const { jobId } = req.params;

		if (!jobId) {
			return res.status(400).json({
				success: false,
				message: "Job ID is required",
			});
		}

		// Connect to database
		const db = await getDb();

		// Check if writer has already bid on this job
		const existingBid = await db.collection("bids").findOne({
			writerId: writerId,
			jobId: jobId,
		});

		// Send response based on whether a bid was found
		res.status(200).json({
			success: true,
			hasBid: !!existingBid,
			bidDetails: existingBid || null,
		});
	} catch (error) {
		console.error("❌ Error checking bid:", error);
		res.status(500).json({
			success: false,
			message: "Failed to check bid status",
		});
	}
};
