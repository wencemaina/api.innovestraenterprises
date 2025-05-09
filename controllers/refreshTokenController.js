const { connectToMongo, getDb } = require("../db");
const crypto = require("crypto");

const generateToken = (length = 64) => {
	return crypto.randomBytes(length).toString("hex");
};

const calculateAccessExpiration = () => {
	const expiresAt = new Date();
	expiresAt.setHours(expiresAt.getHours() + 12);
	return expiresAt;
};

const calculateRefreshExpiration = () => {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 7);
	return expiresAt;
};

exports.refreshToken = async (req, res) => {
	console.log("🔄 Received refresh token request");

	const refreshToken = req.cookies?._rf_9yp;

	if (!refreshToken) {
		console.warn("⛔ No refresh token found in cookies");
		return res.status(401).json({ message: "Refresh token is required" });
	}

	try {
		await connectToMongo();
		const db = getDb();
		const sessionsCollection = db.collection("sessions");

		const session = await sessionsCollection.findOne({
			refreshToken,
			is_valid: true,
			refreshExpiresAt: { $gt: new Date() },
		});

		if (!session) {
			console.warn("⛔ Invalid, expired, or revoked refresh token");
			return res.status(401).json({
				message: "Invalid, expired, or revoked refresh token",
			});
		}

		const userId = session.userId;
		console.log(`✅ Valid session found for user: ${userId}`);

		const newAccessToken = generateToken();
		const newRefreshToken = generateToken();

		const updatedSessionData = {
			accessToken: newAccessToken,
			refreshToken: newRefreshToken,
			expiresAt: calculateAccessExpiration(),
			refreshExpiresAt: calculateRefreshExpiration(),
		};

		const result = await sessionsCollection.updateOne(
			{ userId },
			{ $set: updatedSessionData },
		);

		if (!result.modifiedCount) {
			console.error("⚠️ Failed to update session with new tokens");
			return res
				.status(500)
				.json({ message: "Failed to refresh tokens" });
		}

		console.log("✅ Session updated with new tokens");

		// Cookie settings for both domains
		const cookieOptions = {
			httpOnly: true,
			path: "/",
			sameSite: "Lax",
			secure: false,
		};

		// Set cookies for localhost
		res.cookie("_ax_13z", newAccessToken, {
			...cookieOptions,
			domain: "localhost",
			maxAge: 12 * 60 * 60 * 1000,
		});
		res.cookie("_rf_9yp", newRefreshToken, {
			...cookieOptions,
			domain: "localhost",
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		// Set cookies for sitizenn.com
		res.cookie("_ax_13z", newAccessToken, {
			...cookieOptions,
			domain: ".sitizenn.com",
			sameSite: "None",
			secure: true,
			maxAge: 12 * 60 * 60 * 1000,
		});
		res.cookie("_rf_9yp", newRefreshToken, {
			...cookieOptions,
			domain: ".sitizenn.com",
			sameSite: "None",
			secure: true,
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		return res
			.status(200)
			.json({ message: "Tokens refreshed successfully" });
	} catch (error) {
		console.error("💥 Error refreshing tokens:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};
