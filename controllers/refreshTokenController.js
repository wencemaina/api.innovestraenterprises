const { v4: uuidv4 } = require("uuid");
const { connectToMongo, getDb } = require("../db"); // Adjust the path if needed
const crypto = require("crypto");

// Utility function to generate a new token (using crypto, as in your original code)
const generateToken = (length = 64) => {
	return crypto.randomBytes(length).toString("hex");
};

// Utility function to calculate expiration time (12 hours from now)
const calculateExpiration = () => {
	const expiresAt = new Date();
	expiresAt.setHours(expiresAt.getHours() + 12); // 12 hours
	return expiresAt;
};

// Utility function to calculate refresh token expiration (7 days from now)
const calculateRefreshExpiration = () => {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
	return expiresAt;
};

exports.refreshToken = async (req, res) => {
	console.log("Received refresh token request");
	// Extract refresh token from HTTP-only cookie
	const refreshToken = req.cookies?._rf_9yp;

	// Check if refresh token exists
	if (!refreshToken) {
		return res.status(401).json({ message: "Refresh token is required" });
	}

	try {
		await connectToMongo();
		const db = getDb();
		const sessionsCollection = db.collection("sessions");
		const usersCollection = db.collection("users"); //added users collection

		// Retrieve session by refresh token,  and is_valid = true, and refresh_expires_at > NOW()
		const session = await sessionsCollection.findOne({
			refreshToken: refreshToken,
			is_valid: true,
			expiresAt: { $gt: new Date() }, // Check expiration
		});

		if (!session) {
			console.error("Invalid, expired, or revoked refresh token");
			return res.status(401).json({
				message: "Invalid, expired, or revoked refresh token",
			});
		}

		const userId = session.userId;

		// Generate new tokens
		const newAccessToken = generateToken();
		const newRefreshToken = generateToken();

		// Update the existing session with new tokens and expiration
		const updatedSessionData = {
			accessToken: newAccessToken,
			refreshToken: newRefreshToken,
			expiresAt: calculateExpiration(), // Update access token expiration
			expiresAt: calculateRefreshExpiration(),
		};

		const result = await sessionsCollection.updateOne(
			{ _id: session._id }, // Use the session's _id for updating
			{ $set: updatedSessionData },
		);

		if (!result.modifiedCount) {
			console.error("Failed to update session with new tokens");
			return res
				.status(500)
				.json({ message: "Failed to refresh tokens" }); // Or a more specific error
		}
		// Set new tokens in cookies
		res.cookie("_ax_13z", newAccessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "None",
			domain: ".sitizenn.com",
			path: "/",
			maxAge: 12 * 60 * 60 * 1000, // 12 hours
		});

		res.cookie("_rf_9yp", newRefreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "None",
			domain: ".sitizenn.com",
			path: "/",
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		});

		res.cookie("_ax_13z", newAccessToken, {
			httpOnly: true,
			secure: false,
			sameSite: "Lax", // Required for cross-origin cookies
			domain: "localhost",
			path: "/", // Allow access from all paths
			maxAge: 12 * 60 * 60 * 1000, // 12 hours
		});

		res.cookie("_rf_9yp", newRefreshToken, {
			httpOnly: true,
			secure: false,
			sameSite: "Lax",
			domain: "localhost",
			path: "/",
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		});

		return res
			.status(200)
			.json({ message: "Tokens refreshed successfully" });
	} catch (error) {
		console.error("Error refreshing tokens:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};
