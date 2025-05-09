const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const { connectToMongo, getDb } = require("../db");

// Function to generate random tokens
function generateTokens() {
	const accessToken = crypto.randomBytes(32).toString("hex");
	const refreshToken = crypto.randomBytes(32).toString("hex");
	return { accessToken, refreshToken };
}

// Helper function to set cookies
function setCookies(req, res, accessToken, refreshToken) {
	// Determine environment
	const isProduction = process.env.NODE_ENV === "production";

	// Log environment for debugging
	console.log(`Environment: ${isProduction ? "production" : "development"}`);

	// Cookie settings based on environment
	const cookieSettings = {
		httpOnly: true,
		secure: isProduction, // true in production, false in development
		sameSite: isProduction ? "None" : "Lax", // "None" for cross-origin in production, "Lax" for development
		path: "/",
	};

	// Set cookies
	res.cookie("_ax_13z", accessToken, {
		...cookieSettings,
		maxAge: 12 * 60 * 60 * 1000, // 12 hours
	});

	res.cookie("_rf_9yp", refreshToken, {
		...cookieSettings,
		maxAge: 12 * 60 * 60 * 1000, // 12 hours for both tokens
	});
}

exports.login = async (req, res) => {
	console.log("Login request received:", req.body);

	try {
		const { email, password, userType, platform = "web" } = req.body;

		// Basic validation before hitting DB
		if (
			!email?.trim() ||
			!password?.trim() ||
			!userType?.trim() ||
			typeof email !== "string" ||
			!email.includes("@")
		) {
			return res.status(400).json({
				message: "Invalid email, password, or user type format",
			});
		}

		// Validate platform
		if (!["web", "mobile"].includes(platform)) {
			return res.status(400).json({
				message: "Invalid platform. Must be 'web' or 'mobile'",
			});
		}

		await connectToMongo();
		const db = getDb();
		const usersCollection = db.collection("users");
		const sessionsCollection = db.collection("sessions");

		// First check if user already has an active session
		const existingSession = await sessionsCollection.findOne({
			"personalInfo.email": email.toLowerCase(),
			platform: platform,
			isActive: true,
		});

		// If session exists, return it directly
		if (existingSession) {
			console.log(`Found existing ${platform} session for email:`, email);

			// Set cookies based on existing session
			setCookies(
				req,
				res,
				existingSession.accessToken,
				existingSession.refreshToken,
			);

			return res.status(200).json({
				message: "Session resumed",
				userId: existingSession.userId,
				userType: existingSession.userType,
				sessionId: existingSession.sessionId,
				platform: platform,
			});
		}

		// No existing session, proceed with normal login
		// Find the user by email
		const user = await usersCollection.findOne({
			"personalInfo.email": email.toLowerCase(),
		});

		if (!user) {
			return res.status(400).json({ message: "Email not registered" });
		}

		// Verify user type matches
		if (user.userType !== userType) {
			return res
				.status(401)
				.json({ message: "Invalid user type for this account" });
		}

		// Password verification
		const passwordMatch = await bcrypt.compare(
			password,
			user.securityCredentials.hashed_password,
		);

		if (!passwordMatch) {
			return res
				.status(401)
				.json({ message: "Invalid email or password" });
		}

		// Use userId from the user document
		const userId = user.userId;

		// Generate new tokens
		const { accessToken, refreshToken } = generateTokens();

		// Create a new session
		console.log(`Creating new ${platform} session for user:`, userId);
		const sessionId = uuidv4();

		const sessionData = {
			userId: userId,
			userType: userType,
			accessToken: accessToken,
			refreshToken: refreshToken,
			platform: platform,
			isActive: true,
			sessionId: sessionId,
			expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
			createdAt: new Date(),
			lastActive: new Date(),
		};

		// Insert the session data into the sessions collection
		try {
			await sessionsCollection.insertOne(sessionData);
			console.log(
				`${platform} session created successfully for user:`,
				userId,
			);
		} catch (sessionError) {
			console.error("Error creating session:", sessionError);
			return res.status(500).json({
				message: "Failed to create session",
				error: sessionError.message,
			});
		}

		// Set cookies
		setCookies(req, res, accessToken, refreshToken);

		// For debugging only - remove in production
		if (process.env.NODE_ENV !== "production") {
			console.log("Access Token:", accessToken);
			console.log("Refresh Token:", refreshToken);
		}

		// Return user information
		return res.status(200).json({
			message: "Authentication successful",
			userId: userId,
			userType: userType,
			sessionId: sessionId,
			platform: platform,
		});
	} catch (error) {
		console.error("Login initiation error:", error);
		return res.status(500).json({
			message: "Internal server error",
			error:
				process.env.NODE_ENV === "production"
					? "Internal server error"
					: error.toString(),
			stack: process.env.NODE_ENV === "production" ? null : error.stack,
		});
	}
};

/* New Session Schema Example:
{
  "userId": "52d7dfeb-ceaf-47c7-aceb-070630f13082",
  "userType": "writer",
  "accessToken": "bfad33f2ba7c871282e14fdd2696de47a89a436f708fa7fa737f3b11fde1fb04",
  "refreshToken": "027f2b5f0c4f663c2d7d69bcaf03fcf781a3f7d72fcf30383813339dcb4eb8e5",
  "platform": "web",  // "web" or "mobile"
  "isActive": true,
  "sessionId": "2704ad89-fa59-40d1-8520-35c5eebfea6a",
  "expiresAt": "2025-05-09T22:44:02.664Z", // 12 hours from creation
  "createdAt": "2025-05-09T10:44:02.664Z",
  "lastActive": "2025-05-09T14:21:45.806Z"
}
*/
