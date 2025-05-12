const { getDb } = require("../db");

/**

 * Enhanced controller to verify authentication status from various sources

 * Checks both cookies and Authorization header to maximize compatibility

 */

exports.checkAuthStatus = async (req, res) => {
	console.log("---------- AUTH STATUS CHECK ----------");

	console.log("Received auth status check request");

	console.log("Request path:", req.path);

	console.log("Request method:", req.method);

	console.log(
		"Request headers:",

		JSON.stringify(
			{
				origin: req.headers.origin,

				referer: req.headers.referer,

				host: req.headers.host,

				"user-agent": req.headers["user-agent"],

				"content-type": req.headers["content-type"],
			},

			null,

			2,
		),
	);

	// Log cookies if available

	console.log(
		"Request cookies:",

		req.cookies
			? JSON.stringify(req.cookies, null, 2)
			: "Cookie parser not configured",
	);

	// Extract tokens from multiple possible sources

	let accessToken = null;

	let refreshToken = null;

	// 1. Try cookies (primary method)

	console.log("\n=== COOKIE TOKEN CHECK ===");

	if (req.cookies) {
		accessToken = req.cookies._ax_13z || null;

		refreshToken = req.cookies._rf_9yp || null;

		console.log(
			"Cookie access token (_ax_13z):",

			accessToken ? `${accessToken.substring(0, 10)}...` : "Not present",
		);

		console.log(
			"Cookie refresh token (_rf_9yp):",

			refreshToken
				? `${refreshToken.substring(0, 10)}...`
				: "Not present",
		);
	} else {
		console.log("Cookie parser middleware not detected");
	}

	// 2. Try Authorization header (backup method)

	console.log("\n=== AUTHORIZATION HEADER CHECK ===");

	const authHeader = req.headers.authorization;

	if (authHeader && authHeader.startsWith("Bearer ")) {
		// If no access token from cookies, use the one from Authorization header

		if (!accessToken) {
			accessToken = authHeader.substring(7);

			console.log(
				"Authorization header token:",

				accessToken
					? `${accessToken.substring(0, 10)}...`
					: "Not present",
			);
		} else {
			console.log(
				"Skipping Authorization header (already have token from cookies)",
			);
		}
	} else {
		console.log("No valid Authorization header found");
	}

	// 3. Try request body (for compatibility with certain clients)

	console.log("\n=== REQUEST BODY TOKEN CHECK ===");

	if (req.body && (req.body.accessToken || req.body.refreshToken)) {
		if (!accessToken && req.body.accessToken) {
			accessToken = req.body.accessToken;

			console.log(
				"Body access token:",

				accessToken
					? `${accessToken.substring(0, 10)}...`
					: "Not present",
			);
		}

		if (!refreshToken && req.body.refreshToken) {
			refreshToken = req.body.refreshToken;

			console.log(
				"Body refresh token:",

				refreshToken
					? `${refreshToken.substring(0, 10)}...`
					: "Not present",
			);
		}
	} else {
		console.log("No tokens in request body");
	}

	console.log("\n=== FINAL TOKEN STATUS ===");

	console.log(
		"Access token:",

		accessToken ? `${accessToken.substring(0, 10)}...` : "Not found",
	);

	console.log(
		"Refresh token:",

		refreshToken ? `${refreshToken.substring(0, 10)}...` : "Not found",
	);

	// Check if any token is available for authentication

	if (!accessToken && !refreshToken) {
		console.log("Authentication failed: No valid tokens provided");

		return res.status(401).json({
			message: "Please log in to continue.",

			error: "No authentication tokens found",
		});
	}

	try {
		console.log("\n=== DATABASE OPERATIONS ===");

		console.log("Connecting to database...");

		const db = getDb();

		if (!db) {
			throw new Error("Failed to connect to database");
		}

		console.log("Database connection established");

		const sessionsCollection = db.collection("sessions");

		if (!sessionsCollection) {
			throw new Error("Failed to access sessions collection");
		}

		console.log("Querying sessions collection for valid session...");

		// Build query based on available tokens

		const query = { isActive: true };

		if (accessToken) {
			query.accessToken = accessToken;
		}

		if (refreshToken) {
			query.refreshToken = refreshToken;
		}

		console.log("MongoDB query:", JSON.stringify(query));

		// Retrieve the session using the available tokens

		const session = await sessionsCollection.findOne(query);

		console.log("Session found:", !!session);

		if (!session) {
			console.log("Authentication failed: Invalid or expired session");

			return res.status(401).json({
				message: "Invalid session. Please log in again.",
			});
		}

		const userId = session.userId;

		const expiresAt = session.expiresAt;

		const sessionId = session.sessionId;

		console.log("Session belongs to user:", userId);

		console.log("Session ID:", sessionId);

		console.log("Session expires at:", new Date(expiresAt).toISOString());

		// Fetch the user to get the userType

		console.log("Querying users collection for user details...");

		const usersCollection = db.collection("users");

		const user = await usersCollection.findOne({ userId: userId });

		console.log("User found:", !!user);

		if (!user) {
			console.log("Authentication failed: User not found in database");

			return res.status(404).json({ message: "User not found." });
		}

		console.log("User type:", user.userType);

		// Update lastActive timestamp for the session

		await sessionsCollection.updateOne(
			{ sessionId },

			{ $set: { lastActive: new Date() } },
		);

		// If session is valid, prepare response with user details

		const response = {
			message: "User is authenticated.",

			userId: userId,

			userType: user.userType,

			email: session.email,

			expiresAt: expiresAt,

			platform: session.platform,

			sessionId: sessionId,
		};

		console.log("Authentication successful");

		console.log("Auth status response:", response);

		console.log("---------- END AUTH STATUS CHECK ----------");

		// Before returning the response, check if we need to refresh cookies

		// This helps keep cookies alive even if they're about to expire

		if (accessToken && accessToken === session.accessToken) {
			console.log("Refreshing cookies with existing tokens");

			// Simple helper to set cookies inline

			const setCookie = (name, value, maxAgeDays) => {
				const isProduction = process.env.NODE_ENV === "production";

				const isLocalhost =
					req.hostname.includes("localhost") ||
					req.hostname.includes("127.0.0.1");

				const options = {
					httpOnly: true,

					secure: isProduction,

					sameSite: isProduction ? "None" : "Lax",

					path: "/",

					maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
				};

				// Set domain based on environment

				if (isProduction) {
					options.domain = ".wencestudios.com"; // Adjust based on your domain
				} else if (isLocalhost) {
					options.domain = "localhost";
				} else {
					options.domain = req.hostname.split(":")[0];
				}

				res.cookie(name, value, options);
			};

			// Refresh the cookies

			setCookie("_ax_13z", accessToken, 0.5); // 12 hours

			if (refreshToken) {
				setCookie("_rf_9yp", refreshToken, 7); // 7 days
			}
		}

		// Return the response

		return res.status(200).json(response);
	} catch (error) {
		console.error("---------- AUTH STATUS ERROR ----------");

		console.error("Error validating session:", error);

		console.error("Error message:", error.message);

		console.error("Error stack:", error.stack);

		console.error("---------- END AUTH STATUS ERROR ----------");

		// Return error response with detailed information

		return res.status(500).json({
			message: "Failed to authenticate. Please try again later.",

			error: error.toString(),

			stack:
				process.env.NODE_ENV === "production" ? undefined : error.stack,
		});
	}
};
