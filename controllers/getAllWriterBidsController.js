const { getDb } = require("../db");

/**
 * Get all bids submitted by the current writer
 * @route GET /api/jobs/bids/writer
 * @access Private - Writer only
 */
exports.getAllWriterBids = async (req, res) => {
	try {
		console.log("🔄 Received request to get all writer bids");
		const cookieKey = "YwAsmAN";
		const writerId = req.cookies?.[cookieKey];

		// Validate writer ID from cookie
		if (!writerId) {
			console.log("❌ Writer ID not found in cookies");
			return res.status(401).json({
				success: false,
				message: "Unauthorized. Please log in again.",
			});
		}

		// Connect to database
		const db = await getDb();

		// Fetch all bids for this writer
		const bids = await db
			.collection("bids")
			.find({ writerId })
			.sort({ createdAt: -1 }) // Sort by newest first
			.toArray();

		console.log(
			`✅ Successfully fetched ${
				bids.length
			} bids for writer: ${writerId.substring(0, 8)}...`,
		);

		// If we want to enrich the bids with job details, we could do that here
		// For example, getting job details for each bid to include more information
		// This is optional and depends on how much job info you want to include

		/* 
    // Example of enriching bids with job details (if needed)
    const jobIds = [...new Set(bids.map(bid => bid.jobId))];
    const jobs = await db
      .collection("jobs")
      .find({ id: { $in: jobIds } })
      .toArray();
    
    const jobsMap = jobs.reduce((map, job) => {
      map[job.id] = job;
      return map;
    }, {});
    
    const enrichedBids = bids.map(bid => ({
      ...bid,
      jobDetails: jobsMap[bid.jobId] || null
    }));
    */

		// Return the bids
		return res.status(200).json(bids);
	} catch (error) {
		console.error("❌ Error fetching writer bids:", error);
		return res.status(500).json({
			success: false,
			message: "Failed to fetch bids. Please try again later.",
		});
	}
};

/**
 * Get a single bid by ID
 * @route GET /api/jobs/bids/:bidId
 * @access Private - Writer who submitted the bid or client who received it
 */
exports.getBidById = async (req, res) => {
	try {
		const { bidId } = req.params;
		const cookieKey = "YwAsmAN";
		const userId = req.cookies?.[cookieKey];

		if (!userId) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized. Please log in again.",
			});
		}

		const db = await getDb();

		// Convert string ID to ObjectId if using MongoDB ObjectId
		// const { ObjectId } = require('mongodb');
		// const bid = await db.collection("bids").findOne({ _id: new ObjectId(bidId) });

		// If not using ObjectId, use this:
		const bid = await db.collection("bids").findOne({ _id: bidId });

		if (!bid) {
			return res.status(404).json({
				success: false,
				message: "Bid not found",
			});
		}

		// Security check: Only the writer who submitted the bid or the client who received it can view it
		// You would need to check against client ID as well if that's a requirement
		if (bid.writerId !== userId) {
			return res.status(403).json({
				success: false,
				message: "You don't have permission to view this bid",
			});
		}

		return res.status(200).json(bid);
	} catch (error) {
		console.error("Error fetching bid:", error);
		return res.status(500).json({
			success: false,
			message: "Failed to fetch bid details. Please try again later.",
		});
	}
};

/**
 * Update bid status (primarily for writers to cancel their bids)
 * @route PUT /api/jobs/bids/:bidId
 * @access Private - Writer who submitted the bid
 */
exports.updateBidStatus = async (req, res) => {
	try {
		const { bidId } = req.params;
		const { status } = req.body;
		const cookieKey = "YwAsmAN";
		const writerId = req.cookies?.[cookieKey];

		if (!writerId) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized. Please log in again.",
			});
		}

		if (!status || !["cancelled"].includes(status)) {
			return res.status(400).json({
				success: false,
				message:
					"Invalid status update. Writers can only cancel their bids.",
			});
		}

		const db = await getDb();

		// Find the bid first to check ownership
		const bid = await db.collection("bids").findOne({ _id: bidId });

		if (!bid) {
			return res.status(404).json({
				success: false,
				message: "Bid not found",
			});
		}

		// Check if this writer owns the bid
		if (bid.writerId !== writerId) {
			return res.status(403).json({
				success: false,
				message: "You don't have permission to update this bid",
			});
		}

		// Check if bid is already accepted and prevent cancellation
		if (bid.status === "accepted") {
			return res.status(400).json({
				success: false,
				message: "Cannot cancel a bid that has already been accepted",
			});
		}

		// Update the bid
		const updatedBid = await db
			.collection("bids")
			.findOneAndUpdate(
				{ _id: bidId, writerId },
				{ $set: { status, updatedAt: new Date() } },
				{ returnDocument: "after" },
			);

		return res.status(200).json({
			success: true,
			message: "Bid status updated successfully",
			bid: updatedBid.value,
		});
	} catch (error) {
		console.error("Error updating bid status:", error);
		return res.status(500).json({
			success: false,
			message: "Failed to update bid status. Please try again later.",
		});
	}
};

module.exports = exports;
