const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto"); // For generating random strings
const { connectToMongo, getDb } = require("../db"); // Adjust the path if needed

// Function to generate random tokens
function generateTokens() {
	const accessToken = crypto.randomBytes(32).toString("hex"); // 256 bits
	const refreshToken = crypto.randomBytes(32).toString("hex"); // 256 bits
	return { accessToken, refreshToken };
}

exports.login = async (req, res) => {
	console.log("Login request received:", req.body); // Log the request body for debugging

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
			return res
				.status(400)
				.json({
					message: "Invalid email, password, or user type format",
				});
		}

		await connectToMongo(); // Ensure MongoDB connection
		const db = getDb();
		const usersCollection = db.collection("users");
		const sessionsCollection = db.collection("sessions"); // Get the sessions collection

		// Find the user by email - corrected path based on actual data structure
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

		const userId = user._id; // Get the user's ID from the found document
		const sessionId = uuidv4(); // Generate a unique session ID
		const { accessToken, refreshToken } = generateTokens(); // Generate tokens

		const sessionData = {
			userId: userId,
			userType: userType, // Store the user type in the session
			accessToken: accessToken,
			refreshToken: refreshToken,
			sessionId: sessionId, // Include the sessionId in the database document
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Session expires with refresh token (7 days)
			createdAt: new Date(),
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

		// Set cookies for production
		res.cookie("_ax_13z", accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
			domain:
				process.env.NODE_ENV === "production"
					? ".sitizenn.com"
					: "localhost",
			path: "/",
			maxAge: 12 * 60 * 60 * 1000, // 12 hours
		});

		res.cookie("_rf_9yp", refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
			domain:
				process.env.NODE_ENV === "production"
					? ".sitizenn.com"
					: "localhost",
			path: "/",
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		});

		// Log the tokens (for debugging - remove in production)
		console.log("Access Token:", accessToken);
		console.log("Refresh Token:", refreshToken);

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
