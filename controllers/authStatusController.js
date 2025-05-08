const { connectToMongo, getDb } = require("../db"); // Adjust the path if needed

exports.checkAuthStatus = async (req, res) => {
	// Extract tokens from cookies
	const accessToken = req.cookies?._ax_13z;
	const refreshToken = req.cookies?._rf_9yp;

	console.log("Access token:", accessToken);
	console.log("Refresh token:", refreshToken);

	if (!accessToken || !refreshToken) {
		return res.status(401).json({ message: "Please log in to continue." });
	}

	try {
		await connectToMongo();
		const db = getDb();
		const sessionsCollection = db.collection("sessions");

		// Retrieve the session using both access and refresh tokens
		const session = await sessionsCollection.findOne({
			accessToken: accessToken,
			refreshToken: refreshToken,
			is_valid: true, // Ensure the session is marked as valid
			expiresAt: { $gt: new Date() }, // Check if the access token is expired
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
