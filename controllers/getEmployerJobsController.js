const { connectToMongo, getDb } = require("../db");

exports.getEmployerJobs = async (req, res) => {
	console.log("🔄 Received get employer jobs request");

	const platform = req.headers["x-device-type"] || "web";

	try {
		// Extract employer ID from cookie
		const employerId = req.cookies.YwAsmAN;

		if (!employerId) {
			console.warn("⛔ No employer ID found in cookies");
			return res
				.status(401)
				.json({ message: "Unauthorized: No employer ID found" });
		}

		await connectToMongo();
		const db = getDb();
		const jobsCollection = db.collection("jobs");

		// Fetch only jobs where employerId matches
		const jobsData = await jobsCollection
			.find({ employerId: employerId })
			.toArray();

		if (!jobsData || jobsData.length === 0) {
			console.warn(`⛔ No jobs found for employer ${employerId}`);
			return res
				.status(404)
				.json({ message: "No jobs found for this employer" });
		}

		// Map and format the jobs
		const jobs = jobsData.map((job) => ({
			id: job._id.toString(),
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

		console.log(`✅ Found ${jobs.length} jobs for employer ${employerId}`);
		return res
			.status(200)
			.json({ message: "Employer jobs retrieved successfully", jobs });
	} catch (error) {
		console.error("[ERROR] getEmployerJobs:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};
