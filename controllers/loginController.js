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
	// Get the hostname and origin for domain handling
	const host = req.get("host") || "";
	const origin = req.get("origin") || "";

	// Determine if we're on localhost
	const isLocalhost =
		host.includes("localhost") ||
		host.includes("127.0.0.1") ||
		origin.includes("localhost") ||
		origin.includes("127.0.0.1");

	// Base cookie settings
	const cookieSettings = {
		httpOnly: true,
		secure: !isLocalhost, // true in production, false on localhost
		sameSite: isLocalhost ? "Lax" : "None", // "Lax" for localhost, "None" for cross-origin
		path: "/",
	};

	// Set domain based on environment
	if (isLocalhost) {
		// No domain for localhost to ensure cookie works
		delete cookieSettings.domain;
	} else {
		// Use the base domain for production
		cookieSettings.domain = ".innovestraenterprises.co.ke";
	}

	console.log("Is localhost:", isLocalhost);
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
	console.log("Web login request received:", req.body);

	try {
		const { email, password, userType } = req.body;
		const platform = "web"; // This controller is always for web logins

		// Basic validation before hitting DB
		if (
			!email?.trim() ||
			!password?.trim() ||
			!userType?.trim() ||
			typeof email !== "string" ||
			!email.includes("@")
		) {
			console.log("Login validation failed for email:", email);
			return res.status(400).json({
				message: "Invalid email, password, or user type format",
			});
		}

		await connectToMongo();
		const db = getDb();
		const usersCollection = db.collection("users");
		const sessionsCollection = db.collection("sessions");

		// Find the user by email first to validate credentials
		const user = await usersCollection.findOne({
			"personalInfo.email": email.toLowerCase(),
		});

		if (!user) {
			console.log(`[WEB LOGIN] Email not registered: ${email}`);
			return res.status(400).json({ message: "Email not registered" });
		}

		// Verify user type matches
		if (user.userType !== userType) {
			console.log(
				`[WEB LOGIN] Invalid user type for ${email}: got ${userType}, expected ${user.userType}`,
			);
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
			console.log(`[WEB LOGIN] Invalid password for ${email}`);
			return res
				.status(401)
				.json({ message: "Invalid email or password" });
		}

		console.log(`[WEB LOGIN] User authenticated successfully: ${email}`);
		// Use userId from the user document
		const userId = user.userId;

		// Check if user already has ANY active session
		const existingSessions = await sessionsCollection
			.find({
				userId: userId,
				isActive: true,
			})
			.toArray();

		// Delete any existing active sessions for this user
		if (existingSessions.length > 0) {
			console.log(
				`[WEB LOGIN] Found ${existingSessions.length} existing sessions for user: ${userId} (${email}). Deleting them.`,
			);

			await sessionsCollection.deleteMany({
				userId: userId,
				isActive: true,
			});

			console.log(
				`[WEB LOGIN] Deleted existing sessions for user: ${userId}`,
			);
		}

		// Create a new session
		console.log(
			`[WEB LOGIN] Creating new session for user: ${userId} (${email})`,
		);

		// Generate new tokens
		const { accessToken, refreshToken } = generateTokens();
		const sessionId = uuidv4();

		const sessionData = {
			userId: userId,
			userType: userType,
			email: email.toLowerCase(), // Store email directly in the session object
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
				`[WEB LOGIN] Session created successfully: ${sessionId} for user: ${userId}`,
			);
		} catch (sessionError) {
			console.error("[WEB LOGIN] Error creating session:", sessionError);
			return res.status(500).json({
				message: "Failed to create session",
				error: sessionError.message,
			});
		}

		// Set cookies
		setCookies(req, res, accessToken, refreshToken);
		console.log(`[WEB LOGIN] Cookies set for user: ${userId}`);

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
		console.error("[WEB LOGIN] Login error:", error);

		// Return error details regardless of environment
		return res.status(500).json({
			message: "Internal server error",
			error: error.toString(),
			stack: error.stack,
		});
	}
};
