const { getDb } = require("../db");

exports.getJobById = async (req, res) => {
	try {
		const id = req.params.jobId;
		console.log("Requested job ID:", id);

		// Get database connection
		const db = await getDb();

		// Query the jobs collection for the job with the id field (not _id)
		const job = await db.collection("jobs").findOne({ id: id });

		if (!job) {
			return res.status(404).json({ message: "Job not found" });
		}

		res.status(200).json(job);
	} catch (error) {
		console.error("Error fetching job:", error);
		res.status(500).json({
			message: "Error fetching job",
			error: error.message,
		});
	}
};
