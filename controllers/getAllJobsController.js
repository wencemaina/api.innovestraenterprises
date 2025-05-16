const { connectToMongo, getDb } = require("../db");

exports.getAllJobs = async (req, res) => {
	console.log("🔄 Received get all jobs request");

	const platform = req.headers["x-device-type"] || "web";

	try {
		await connectToMongo();
		const db = getDb();
		const jobsCollection = db.collection("jobs");

		// Fetch all jobs
		const jobsData = await jobsCollection.find({}).toArray();

		if (!jobsData || jobsData.length === 0) {
			console.warn("⛔ No jobs found");
			return res.status(404).json({ message: "No jobs found" });
		}

		// Map and format the jobs
		const jobs = jobsData.map((job) => ({
			id: job.id, // ✅ use the custom job ID
			title: job.title,
			description: job.description,
			client: job.client,
			budget: job.budget,
			deadline: job.deadline,
			bids: job.bids,
			skills: job.skills,
			isPublic: job.isPublic,
			isPrivate: job.isPrivate,
			isSubmitted: job.isSubmitted,
			isComplete: job.isComplete,
			isCompleteAndPaid: job.isCompleteAndPaid,
			isCancelled: job.isCancelled,
			isOverdue: job.isOverdue,
			isInProgress: job.isInProgress,
			isInRevision: job.isInRevision,
			isDisputed: job.isDisputed,
		}));

		console.log(`✅ Found ${jobs.length} jobs`);
		return res
			.status(200)
			.json({ message: "Jobs retrieved successfully", jobs });
	} catch (error) {
		console.error("[ERROR] getAllJobs:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};
