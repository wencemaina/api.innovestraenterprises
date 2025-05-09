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

		// Use userId from the user document instead of _id
		const userId = user.userId;
		const sessionId = uuidv4();
		const { accessToken, refreshToken } = generateTokens();

		const sessionData = {
			userId: userId,
			userType: userType,
			accessToken: accessToken,
			refreshToken: refreshToken,
			sessionId: sessionId,
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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

		// Set cookies for production domain
		res.cookie("_ax_13z", accessToken, {
			httpOnly: true,
			secure: true, //  set to true.
			sameSite: "None", //  None for cross-site
			domain: ".sitizenn.com",
			path: "/",
			maxAge: 12 * 60 * 60 * 1000, // 12 hours
		});

		res.cookie("_rf_9yp", refreshToken, {
			httpOnly: true,
			secure: true, //  set to true
			sameSite: "None", //  None for cross-site
			domain: ".sitizenn.com",
			path: "/",
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		});

		// Set cookies for localhost
		res.cookie("_ax_13z", accessToken, {
			httpOnly: true,
			secure: false, //  false for localhost
			sameSite: "Lax", //  Lax for localhost
			domain: "localhost",
			path: "/",
			maxAge: 12 * 60 * 60 * 1000, // 12 hours
		});

		res.cookie("_rf_9yp", refreshToken, {
			httpOnly: true,
			secure: false, //  false for localhost
			sameSite: "Lax", //  Lax for localhost
			domain: "localhost",
			path: "/",
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		});

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
