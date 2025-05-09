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

// Function to get device information
function getDeviceInfo(req) {
	const userAgent = req.headers["user-agent"] || "unknown";
	const ipAddress =
		req.headers["x-forwarded-for"] ||
		req.connection.remoteAddress ||
		"unknown";
	const acceptLanguage = req.headers["accept-language"] || "unknown";

	const deviceSignature = `${userAgent}|${ipAddress}|${acceptLanguage}`;
	const deviceHash = crypto
		.createHash("sha256")
		.update(deviceSignature)
		.digest("hex");

	return {
		deviceId: deviceHash,
		deviceType: "web",
		deviceDetails: {
			userAgent: userAgent,
			ip: ipAddress.split(",")[0].trim(),
			language: acceptLanguage,
		},
		lastActive: new Date(),
	};
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
		maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
	});

	// Log what we set for debugging
	console.log(
		`Cookies set with domain: ${domain}, secure: ${cookieSettings.secure}, sameSite: ${cookieSettings.sameSite}`,
	);
}

exports.login = async (req, res) => {
	console.log("Login request received:", req.body);

	try {
		const { email, password, userType } = req.body;

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
		const deviceInfo = getDeviceInfo(req);

		// Generate new tokens regardless of whether we're creating a new session or updating an existing one
		const { accessToken, refreshToken } = generateTokens();

		// Check if an active session already exists for this user
		const existingSession = await sessionsCollection.findOne({
			userId: userId,
			isActive: true,
		});

		let sessionId;

		if (existingSession) {
			// Use existing session
			console.log("Found existing session for user:", userId);
			sessionId = existingSession.sessionId;

			// Check if this device is already registered
			const deviceExists = existingSession.devices.some(
				(device) => device.deviceId === deviceInfo.deviceId,
			);

			// Update the session with new tokens and device info
			if (deviceExists) {
				// Update existing device's lastActive timestamp and tokens
				await sessionsCollection.updateOne(
					{
						sessionId: sessionId,
						"devices.deviceId": deviceInfo.deviceId,
					},
					{
						$set: {
							"devices.$.lastActive": new Date(),
							lastActive: new Date(),
							accessToken: accessToken,
							refreshToken: refreshToken,
						},
					},
				);
			} else {
				// Add this new device to the devices array and update tokens
				await sessionsCollection.updateOne(
					{ sessionId: sessionId },
					{
						$push: { devices: deviceInfo },
						$set: {
							lastActive: new Date(),
							accessToken: accessToken,
							refreshToken: refreshToken,
						},
					},
				);
			}
		} else {
			// Create a new session since none exists
			console.log("Creating new session for user:", userId);
			sessionId = uuidv4();

			const sessionData = {
				userId: userId,
				userType: userType,
				accessToken: accessToken,
				refreshToken: refreshToken,
				isActive: true,
				sessionId: sessionId,
				devices: [deviceInfo],
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
				createdAt: new Date(),
				lastActive: new Date(),
			};

			// Insert the session data into the sessions collection
			try {
				await sessionsCollection.insertOne(sessionData);
				console.log("Session created successfully for user:", userId);
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
/* Session example */

/* {
  _id: "unique-session-id",
  userId: "affbebb9-815d-4956-b808-4dad1f7eb4a3",
  userType: "employer",
  refreshToken: "long-lived-refresh-token-stays-the-same-across-devices",
  accessToken: "", // Don't store access tokens in DB
  isActive: true,
  devices: [
    {
      deviceId: "web-browser-fingerprint-123",
      deviceType: "web",
      lastActive: "2025-05-09T13:08:45.382+00:00"
    },
    {
      deviceId: "mobile-device-id-456",
      deviceType: "mobile",
      lastActive: "2025-05-09T13:12:48.831+00:00"
    }
  ],
  // Instead of multiple expiry dates, just one for the session
  expiresAt: "2025-06-09T13:08:45.382+00:00", // Much longer (e.g., 30 days)
  createdAt: "2025-05-09T13:08:45.382+00:00",
  lastActive: "2025-05-09T13:12:48.831+00:00"
} */
