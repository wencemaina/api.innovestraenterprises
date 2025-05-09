const { getDb } = require("../db"); // Adjust the path if needed

exports.checkAuthStatus = async (req, res) => {
	console.log("Received auth status check request");
	// Extract tokens from cookies
	const accessToken = req.cookies?._ax_13z;
	const refreshToken = req.cookies?._rf_9yp;
	console.log("Access token:", accessToken);
	console.log("Refresh token:", refreshToken);

	if (!accessToken) {
		return res.status(401).json({ message: "Please log in to continue." });
	}

	try {
		const db = getDb();
		const sessionsCollection = db.collection("sessions");

		// Retrieve the session using only the access token
		const session = await sessionsCollection.findOne({
			accessToken: accessToken,
			isActive: true, // Changed from is_valid to isActive to match your schema
			// Removed expiry check as per your requirement
		});

		if (!session) {
			return res
				.status(401)
				.json({ message: "Invalid session. Please log in again." });
		}

		const userId = session.userId;
		const expiresAt = session.expiresAt;

		// If session is valid, return success response with user_id
		return res.status(200).json({
			message: "User is authenticated.",
			userId: userId,
			expiresAt: expiresAt,
		});
	} catch (error) {
		console.error("Error validating session:", error);
		return res.status(500).json({
			message: "Please try again later.",
			error:
				process.env.NODE_ENV === "production"
					? undefined
					: error.toString(),
			stack: process.env.NODE_ENV === "production" ? null : error.stack,
		});
	}
};
