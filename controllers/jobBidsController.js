const { getDb } = require("../db");

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
		const { jobId, jobTitle, bidAmount, deliveryDays, coverLetter } =
			req.body;

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

		// Create bid object with writer information included
		const bid = {
			jobId,
			jobTitle,
			bidAmount: `$${bidAmount}`, // Format as string with $ prefix like in the example
			deliveryTime: `${deliveryDays} days`, // Format as string with "days" suffix
			coverLetter,
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
			bidId: result.insertedId, // Include the bid ID for reference
			deliveryDays,
			createdAt: new Date(),
		};

		// Store notification in the notifications collection
		await db.collection("notifications").insertOne(notification);
		console.log("✅ Notification created for bid submission");

		// Send success response
		res.status(201).json({
			success: true, // Fixed: changed from false to true
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
