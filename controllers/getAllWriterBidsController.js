const { getDb } = require("../db");

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

		// Log the query parameters for debugging
		console.log(`🔍 Searching for bids with writer.id: ${writerId}`);

		// Fetch all bids for this writer - using the correct path to writerId
		// Note: We're now matching on writer.id instead of writerId
		const bids = await db
			.collection("bids")
			.find({ "writer.id": writerId })
			.sort({ createdAt: -1 }) // Sort by newest first
			.project({
				_id: 1,
				bidId: 1,
				jobId: 1,
				jobTitle: 1,
				bidAmount: 1,
				deliveryTime: 1,
				notes: 1,
				writer: 1,
				status: 1,
				submittedAt: 1,
				createdAt: 1,
				acceptedAt: 1,
				acceptedBy: 1,
			}) // Explicitly include all fields
			.toArray();

		// Get all jobIds from the bids
		const jobIds = [...new Set(bids.map((bid) => bid.jobId))];
		console.log(`🔍 Found ${jobIds.length} unique job IDs to fetch`);

		// Fetch all jobs corresponding to these bids
		const jobs = await db
			.collection("jobs")
			.find({ id: { $in: jobIds } })
			.project({
				id: 1,
				description: 1,
				budget: 1,
				title: 1,
				deadline: 1,
				wordCount: 1,
				category: 1,
			})
			.toArray();

		// Create a map of jobs for easy lookup
		const jobsMap = jobs.reduce((map, job) => {
			map[job.id] = job;
			return map;
		}, {});

		// Enrich the bids with relevant job information
		const enrichedBids = bids.map((bid) => {
			const jobInfo = jobsMap[bid.jobId] || {};
			return {
				...bid,
				jobDetails: {
					description: jobInfo.description || "",
					budget: jobInfo.budget || "",
					title: jobInfo.title || bid.jobTitle || "", // Use existing jobTitle as fallback
					deadline: jobInfo.deadline || "",
					wordCount: jobInfo.wordCount || "",
					category: jobInfo.category || "",
				},
			};
		});

		console.log(
			`✅ Successfully fetched ${
				bids.length
			} bids for writer: ${writerId.substring(0, 8)}...`,
		);

		// Log a sample enriched bid to verify structure (only in development)
		if (enrichedBids.length > 0) {
			console.log(
				"📄 Sample enriched bid structure:",
				JSON.stringify(enrichedBids[0], null, 2),
			);
		}

		// Return the enriched bid documents
		return res.status(200).json(enrichedBids);
	} catch (error) {
		console.error("❌ Error fetching writer bids:", error);
		return res.status(500).json({
			success: false,
			message: "Failed to fetch bids. Please try again later.",
		});
	}
};
