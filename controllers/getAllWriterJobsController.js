const { getDb } = require("../db");

exports.getAllWriterJobs = async (req, res) => {
	try {
		const db = getDb();

		// Extract the user ID from the cookie using the specific key
		const cookieKey = "YwAsmAN";
		const writerId = req.cookies?.[cookieKey];

		if (!writerId) {
			return res.status(401).json({ error: "User not authenticated" });
		}

		// Find all jobs where assignedTo matches the writerId
		const jobs = await db
			.collection("jobs")
			.find({ assignedTo: writerId })
			.toArray();

		res.status(200).json({ jobs });
	} catch (error) {
		console.error("Error fetching writer jobs:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
