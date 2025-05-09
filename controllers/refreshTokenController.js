const { connectToMongo, getDb } = require("../db");
const crypto = require("crypto");

const generateToken = (length = 64) => {
	return crypto.randomBytes(length).toString("hex");
};

// Access tokens still expire after 12 hours
const calculateAccessExpiration = () => {
	const expiresAt = new Date();
	expiresAt.setHours(expiresAt.getHours() + 12);
	return expiresAt;
};

exports.refreshToken = async (req, res) => {
	console.log("🔄 Received refresh token request");
	const refreshToken = req.cookies?._rf_9yp;
	const platform = req.headers["x-device-type"] || "web";

	if (!refreshToken) {
		console.warn("⛔ No refresh token found in cookies");
		return res.status(401).json({ message: "Refresh token is required" });
	}

	try {
		await connectToMongo();
		const db = getDb();
		const sessionsCollection = db.collection("sessions");

		// Find the session with the given refresh token that is still active
		const session = await sessionsCollection.findOne({
			refreshToken,
			isActive: true,
			expiresAt: { $gt: new Date() },
		});

		if (!session) {
			console.warn("⛔ Invalid, expired, or revoked refresh token");
			return res.status(401).json({
				message: "Invalid, expired, or revoked refresh token",
			});
		}

		const userId = session.userId;
		const userType = session.userType;
		console.log(`✅ Valid session found for user: ${userId} (${userType})`);

		// Generate new access and refresh tokens
		const newAccessToken = generateToken();
		const newRefreshToken = generateToken();
		const now = new Date();
		const newExpiresAt = calculateAccessExpiration();

		// Update the session with new tokens and last active time
		const result = await sessionsCollection.updateOne(
			{ refreshToken },
			{
				$set: {
					accessToken: newAccessToken,
					refreshToken: newRefreshToken,
					lastActive: now,
					expiresAt: newExpiresAt,
					platform: platform, // Update platform if it changed
				},
			},
		);

		if (!result.matchedCount) {
			console.error("⚠️ Failed to update session");
			return res
				.status(500)
				.json({ message: "Failed to refresh tokens" });
		}

		console.log("✅ Session updated with new access and refresh tokens");

		// Set access token cookie for localhost
		res.cookie("_ax_13z", newAccessToken, {
			httpOnly: true,
			path: "/",
			sameSite: "Lax",
			secure: false,
			domain: "localhost",
			maxAge: 12 * 60 * 60 * 1000, // 12 hours
		});

		// Set refresh token cookie for localhost
		res.cookie("_rf_9yp", newRefreshToken, {
			httpOnly: true,
			path: "/",
			sameSite: "Lax",
			secure: false,
			domain: "localhost",
			maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
		});

		// Set access token cookie for wencestudios.com
		res.cookie("_ax_13z", newAccessToken, {
			httpOnly: true,
			path: "/",
			sameSite: "None",
			secure: true,
			domain: ".wencestudios.com",
			maxAge: 12 * 60 * 60 * 1000, // 12 hours
		});

		// Set refresh token cookie for wencestudios.com
		res.cookie("_rf_9yp", newRefreshToken, {
			httpOnly: true,
			path: "/",
			sameSite: "None",
			secure: true,
			domain: ".wencestudios.com",
			maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
		});

		return res.status(200).json({
			message: "Access and refresh tokens refreshed successfully",
			userType, // Return the user type for the client to use
		});
	} catch (error) {
		console.error("💥 Error refreshing tokens:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};
