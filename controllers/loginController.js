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

function setCookies(req, res, accessToken, refreshToken) {
	// Get the host from the request (mostly for logging purposes)
	const host = req.get("host") || "";

	// Determine if we're on localhost
	const isLocalhost =
		host.includes("localhost") || host.includes("127.0.0.1");

	console.log(`Request host: ${host}`);
	console.log(`Is localhost: ${isLocalhost}`);

	// Base cookie settings
	const cookieSettings = {
		httpOnly: true,
		secure: !isLocalhost, // true in production, false on localhost
		sameSite: isLocalhost ? "Lax" : "None", // "None" for cross-origin in production
		path: "/",
	};

	// Set domain explicitly for production environments
	if (!isLocalhost) {
		// Hardcode your domain with a leading dot to allow sharing across subdomains
		cookieSettings.domain = ".wencestudios.com";
	}

	console.log("Cookie settings:", JSON.stringify(cookieSettings));

	// Set cookies
	res.cookie("_ax_13z", accessToken, {
		...cookieSettings,
		maxAge: 12 * 60 * 60 * 1000, // 12 hours
	});

	res.cookie("_rf_9yp", refreshToken, {
		...cookieSettings,
		maxAge: 12 * 60 * 60 * 1000, // 12 hours
	});

	console.log(
		"Cookies set with domain:",
		cookieSettings.domain || "no domain set",
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

		// Return user information
		return res.status(200).json({
			message: "Authentication successful",
			userId: userId,
			userType: userType,
			sessionId: sessionId,
			platform: platform,
		});
	} catch (error) {
		// Always log the error regardless of environment
		console.error("Login initiation error:", error);

		// Return error details regardless of environment
		return res.status(500).json({
			message: "Internal server error",
			error: error.toString(),
			stack: error.stack,
		});
	}
};
