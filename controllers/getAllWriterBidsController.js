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
