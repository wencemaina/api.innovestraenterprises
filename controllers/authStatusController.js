const { getDb } = require("../db"); // Adjust the path if needed

exports.checkAuthStatus = async (req, res) => {
	console.log("Received auth status check request");

	// Extract tokens from cookies
	const accessToken = req.cookies?._ax_13z;
	const refreshToken = req.cookies?._rf_9yp;

	console.log("Access token present:", !!accessToken);
	console.log("Refresh token present:", !!refreshToken);

	if (!accessToken || !refreshToken) {
		return res.status(401).json({ message: "Please log in to continue." });
	}

	try {
		const db = getDb();
		const sessionsCollection = db.collection("sessions");

		// Simplified query: Focus only on tokens and expiration date
		const session = await sessionsCollection.findOne({
			accessToken: accessToken,
			refreshToken: refreshToken,
			expiresAt: { $gt: new Date() }, // Check if the token is not expired
		});

		console.log("Session found:", !!session);
		if (session) {
			console.log("Session expires at:", session.expiresAt);
			console.log("Current time:", new Date());
		}

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
