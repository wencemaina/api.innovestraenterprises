const { getDb } = require("../db");

const crypto = require("crypto"); // Node.js built-in for generating IDs

/**
 * Generate a custom bid ID
 * Format: BID-{timestamp}-{random}
 * @returns {string} A unique bid identifier
 */
function generateBidId() {
	const timestamp = Date.now().toString(36); // Convert timestamp to base36
	const randomPart = crypto.randomBytes(4).toString("hex"); // Generate 8 random hex characters
	return `BID-${timestamp}-${randomPart}`.toUpperCase();
}

exports.createJobBid = async (req, res) => {
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
		const { jobId, jobTitle, bidAmount, deliveryDays, notes } = req.body;
		// Validate required fields
		if (!jobId || !bidAmount || !deliveryDays) {
			return res.status(400).json({
				success: false,
				message: "Missing required bid information",
			});
		}
		// Get database connection
		const db = await getDb();
		// Fetch the writer's information to include in the bid
		const writer = await db
			.collection("users")
			.findOne({ userId: writerId });
		if (!writer) {
			return res.status(404).json({
				success: false,
				message: "Writer not found",
			});
		}

		// Generate custom bid ID
		const bidId = generateBidId();

		// Create bid object with writer information included
		const bid = {
			bidId: bidId, // Add custom bid ID
			jobId,
			jobTitle,
			bidAmount: `$${bidAmount}`, // Format as string with $ prefix like in the example
			deliveryTime: `${deliveryDays} days`, // Format as string with "days" suffix
			coverLetter: notes, // Renamed from notes to coverLetter to match expected format
			freelancer: {
				id: writerId,
				name: writer.personalInfo.name,
				rating: writer.writerProfile?.rating || 0,
				completedJobs: writer.writerProfile?.completedJobs || 0,
				country: writer.writerProfile?.country || "Kenya",
			},
			status: "pending", // Default status
			submittedAt: "Just now", // Initial submission time text
			createdAt: new Date(), // Actual timestamp for calculations
		};
		// Store bid in database
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
			bidId: bidId, // Use the custom bidId instead of MongoDB's _id
			deliveryDays,
			createdAt: new Date(),
		};
		// Store notification in the notifications collection
		await db.collection("notifications").insertOne(notification);
		console.log("✅ Notification created for bid submission");
		// Send success response
		res.status(201).json({
			success: true,
			message: "Bid submitted successfully",
			bidId: bidId, // Return the custom bidId
		});
	} catch (error) {
		console.error("❌ Error submitting bid:", error);
		res.status(500).json({
			success: false,
			message: "Failed to submit bid",
		});
	}
};
exports.getJobBids = async (req, res) => {
	try {
		const jobId = req.params.jobId;
		console.log(`🔄 Received request to fetch bids for job: ${jobId}`);

		if (!jobId) {
			return res.status(400).json({
				success: false,
				message: "Job ID is required",
			});
		}

		// Extract writer ID from cookies for potential permission checks
		const writerId = req.cookies["YwAsmAN"];

		// Get database connection
		const db = await getDb();

		// Fetch all bids for the specific job
		const bids = await db
			.collection("bids")
			.find({ jobId: jobId })
			.sort({ createdAt: -1 }) // Sort by newest first
			.toArray();

		if (bids.length === 0) {
			console.log(`ℹ️ No bids found for job: ${jobId}`);
			return res.status(200).json({
				success: true,
				message: "No bids found for this job",
				bids: [],
			});
		}

		console.log(`✅ Found ${bids.length} bids for job: ${jobId}`);

		// Return the bids
		res.status(200).json({
			success: true,
			message: "Bids retrieved successfully",
			count: bids.length,
			bids: bids,
		});
	} catch (error) {
		console.error("❌ Error fetching job bids:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch job bids",
		});
	}
};

exports.acceptJobBid = async (req, res) => {
	try {
		console.log("🔄 Received job bid acceptance request", req.params);

		// Extract bid ID from request parameters
		const { bidId } = req.params;

		if (!bidId) {
			return res.status(400).json({
				success: false,
				message: "Bid ID is required",
			});
		}

		// Extract employer ID from cookies (assuming employers are authenticated similarly to writers)
		const employerId = req.cookies["EmPloYeR"]; // Adjust cookie name as needed
		if (!employerId) {
			return res.status(401).json({
				success: false,
				message: "Employer not authenticated",
			});
		}

		// Get database connection
		const db = await getDb();

		// Find the bid to update
		const bid = await db.collection("bids").findOne({
			id: new ObjectId(bidId),
		});

		if (!bid) {
			return res.status(404).json({
				success: false,
				message: "Bid not found",
			});
		}

		// Check if the bid is already accepted (optional validation)
		if (bid.status === "accepted") {
			return res.status(400).json({
				success: false,
				message: "This bid has already been accepted",
			});
		}

		// Update bid status to accepted
		await db.collection("bids").updateOne(
			{ id: new ObjectId(bidId) },
			{
				$set: {
					status: "accepted",
					acceptedAt: new Date(),
					acceptedBy: employerId,
				},
			},
		);

		// Get employer information for notification
		const employer = await db
			.collection("users")
			.findOne({ userId: employerId });
		const employerName = employer?.personalInfo?.name || "Employer";

		// Create notification for the writer
		const writerNotification = {
			type: "bid_accepted",
			title: "Bid Accepted",
			description: `Your bid of ${bid.bidAmount} for job: ${bid.jobTitle} has been accepted!`,
			time: new Date(),
			read: false,
			writerId: bid.freelancer.id,
			employerId,
			jobId: bid.jobId,
			bidId: bid.id,
			createdAt: new Date(),
		};

		// Create notification for the employer
		const employerNotification = {
			type: "bid_accepted",
			title: "Bid Acceptance Confirmed",
			description: `You have accepted ${bid.freelancer.name}'s bid of ${bid.bidAmount} for job: ${bid.jobTitle}`,
			time: new Date(),
			read: false,
			employerId,
			writerId: bid.freelancer.id,
			jobId: bid.jobId,
			bidId: bid.id,
			createdAt: new Date(),
		};

		// Store notifications in the database
		await db
			.collection("notifications")
			.insertMany([writerNotification, employerNotification]);
		console.log("✅ Notifications created for bid acceptance");

		// Send success response
		res.status(200).json({
			success: true,
			message: "Bid accepted successfully",
			bid: {
				...bid,
				status: "accepted",
				acceptedAt: new Date(),
			},
		});
	} catch (error) {
		console.error("❌ Error accepting bid:", error);
		res.status(500).json({
			success: false,
			message: "Failed to accept bid",
		});
	}
};

exports.getAcceptedBids = async (req, res) => {
	try {
		// Either get bids accepted by a specific employer or bids of a specific writer that were accepted
		const { employerId, writerId } = req.query;

		if (!employerId && !writerId) {
			return res.status(400).json({
				success: false,
				message: "Either employerId or writerId is required",
			});
		}

		// Get database connection
		const db = await getDb();

		// Prepare query based on provided parameters
		const query = { status: "accepted" };

		if (employerId) {
			query.acceptedBy = employerId;
		}

		if (writerId) {
			query["freelancer.id"] = writerId;
		}

		// Fetch accepted bids
		const acceptedBids = await db
			.collection("bids")
			.find(query)
			.sort({ acceptedAt: -1 })
			.toArray();

		console.log(`✅ Found ${acceptedBids.length} accepted bids`);

		// Return the accepted bids
		res.status(200).json({
			success: true,
			message: "Accepted bids retrieved successfully",
			count: acceptedBids.length,
			bids: acceptedBids,
		});
	} catch (error) {
		console.error("❌ Error fetching accepted bids:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch accepted bids",
		});
	}
};
