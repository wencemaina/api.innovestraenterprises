const db = require("../db");
const crypto = require("crypto");

// Utility function to generate a new token
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

// Function to retrieve the session by refresh token
const getSessionByRefreshToken = async (refreshToken) => {
	const result = await db.query(
		"SELECT id, user_id, data FROM sessions WHERE data->>'refresh_token' = $1 AND data->>'is_valid' = 'true' AND (data->>'refresh_expires_at')::timestamptz > NOW() FOR UPDATE",
		[refreshToken],
	);
	return result.rows;
};

// Function to insert a new session
const createNewSession = async (
	userId,
	newAccessToken,
	newRefreshToken,
	clientType,
	ipAddress,
	userAgent,
) => {
	const now = new Date();
	const expiresAt = calculateExpiration();
	const refreshExpiresAt = calculateRefreshExpiration();

	const sessionData = {
		is_valid: true,
		created_at: now.toISOString(),
		expires_at: expiresAt.toISOString(),
		refresh_expires_at: refreshExpiresAt.toISOString(),
		ip_address: ipAddress,
		user_agent: userAgent,
		client_type: clientType,
		access_token: newAccessToken,
		refresh_token: newRefreshToken,
	};

	const result = await db.query(
		"INSERT INTO sessions (user_id, data) VALUES ($1, $2) RETURNING id",
		[userId, sessionData],
	);

	return result.rows[0].id;
};

// Main controller function to handle the refresh token request
exports.refreshToken = async (req, res) => {
	console.log("Received refresh token request");
	// Extract refresh token from HTTP-only cookie
	const refreshToken = req.cookies?._rf_9yp;

	// Check if refresh token exists
	if (!refreshToken) {
		return res.status(401).json({ message: "Refresh token is required" });
	}

	try {
		// Retrieve session by refresh token
		const sessionRows = await getSessionByRefreshToken(refreshToken);
		if (sessionRows.length === 0) {
			console.error("Invalid, expired, or revoked refresh token");
			return res.status(401).json({
				message: "Invalid, expired, or revoked refresh token",
			});
		}

		const session = sessionRows[0];
		const user_id = session.user_id;
		const sessionData = session.data;

		// Generate new tokens
		const newAccessToken = generateToken();
		const newRefreshToken = generateToken();

		// Create a new session
		await createNewSession(
			user_id,
			newAccessToken,
			newRefreshToken,
			sessionData.client_type,
			sessionData.ip_address,
			sessionData.user_agent,
		);

		// Invalidate the old session (optional but recommended for security)
		await db.query(
			"UPDATE sessions SET data = jsonb_set(data, '{is_valid}', 'false') WHERE id = $1",
			[session.id],
		);

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
