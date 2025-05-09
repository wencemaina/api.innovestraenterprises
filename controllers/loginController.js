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

// Helper function to set cookies with proper environment detection
function setCookies(req, res, accessToken, refreshToken) {
	// Determine environment
	const isProduction = process.env.NODE_ENV === "production";
	const hostname = req.hostname || "localhost";

	console.log(
		`Request received from hostname: ${hostname}, isProduction: ${isProduction}`,
	);

	// Log cookie setting attempt for debugging
	console.log(
		`Setting cookies for hostname: ${hostname}, isProduction: ${isProduction}`,
	);

	// Determine domain based on environment
	let domain;
	if (isProduction) {
		// Extract main domain from hostname (e.g., 'app.wencestudios.com' -> '.wencestudios.com')
		const domainParts = hostname.split(".");
		if (domainParts.length >= 2) {
			domain = `.${domainParts.slice(-2).join(".")}`;
		} else {
			domain = hostname;
		}
	} else {
		// For local development
		domain = hostname;
	}

	// Cookie settings based on environment
	const cookieSettings = {
		httpOnly: true,
		secure: isProduction, // true in production, false in development
		sameSite: isProduction ? "None" : "Lax", // "None" for cross-origin in production, "Lax" for development
		domain: domain,
		path: "/",
	};

	// Set cookies
	res.cookie("_ax_13z", accessToken, {
		...cookieSettings,
		maxAge: 12 * 60 * 60 * 1000, // 12 hours
	});

	res.cookie("_rf_9yp", refreshToken, {
		...cookieSettings,
		maxAge: 12 * 60 * 60 * 1000, // Changed to 12 hours as requested
	});

	// Log what we set for debugging
	console.log(
		`Cookies set with domain: ${domain}, secure: ${cookieSettings.secure}, sameSite: ${cookieSettings.sameSite}`,
	);
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

		// Find the user by email
		const user = await usersCollection.findOne({
			"personalInfo.email": email.toLowerCase(),
		});

		console.log(
			"User search result:",
			user ? "User found" : "User not found",
		);

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

		// Check if an active session already exists for this user and platform
		const existingSession = await sessionsCollection.findOne({
			userId: userId,
			platform: platform,
			isActive: true,
		});

		let sessionId;

		if (existingSession) {
			// Use existing session
			console.log(`Found existing ${platform} session for user:`, userId);
			sessionId = existingSession.sessionId;

			// Update the session with new tokens
			await sessionsCollection.updateOne(
				{ sessionId: sessionId },
				{
					$set: {
						lastActive: new Date(),
						accessToken: accessToken,
						refreshToken: refreshToken,
					},
				},
			);
		} else {
			// Create a new session since none exists for this platform
			console.log(`Creating new ${platform} session for user:`, userId);
			sessionId = uuidv4();

			const sessionData = {
				userId: userId,
				userType: userType,
				accessToken: accessToken,
				refreshToken: refreshToken,
				platform: platform, // New field: "web" or "mobile"
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
		}

		// Set cookies based on environment
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
  "_id": ObjectId("681e06a2967f4a13f39cc749"),
  "userId": "52d7dfeb-ceaf-47c7-aceb-070630f13082",
  "userType": "writer",
  "accessToken": "bfad33f2ba7c871282e14fdd2696de47a89a436f708fa7fa737f3b11fde1fb04",
  "refreshToken": "027f2b5f0c4f663c2d7d69bcaf03fcf781a3f7d72fcf30383813339dcb4eb8e5",
  "platform": "web",  // "web" or "mobile"
  "isActive": true,
  "sessionId": "2704ad89-fa59-40d1-8520-35c5eebfea6a",
  "expiresAt": "2025-05-10T01:44:02.664Z", // 12 hours from creation
  "createdAt": "2025-05-09T13:44:02.664Z",
  "lastActive": "2025-05-09T14:21:45.806Z"
}
*/
