const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pool = require("../db");
require("dotenv").config();

const saltRounds = 10;

// Helper function to generate random tokens
function generateToken() {
	return crypto.randomBytes(64).toString("hex");
}

// Helper function to generate unique user ID with 'usr_' prefix
function generateUniqueUserId() {
	const randomChars = crypto
		.randomBytes(6)
		.toString("base64")
		.substring(0, 10)
		.replace(/[+/]/g, "0")
		.toLowerCase();
	return `usr_${randomChars}`;
}

// Signup controller
exports.signup = async (req, res) => {
	const pgClient = await pool.connect(); // Get client from pool
	try {
		await pgClient.query("BEGIN"); // Begin transaction

		const {
			first_name,
			last_name,
			email,
			phone,
			password,
			date_of_birth,
			gender,
		} = req.body;

		// Validate input
		if (!first_name || !last_name || !email || !phone || !password) {
			return res.status(400).json({ message: "All fields are required" });
		}

		// Check if the user already exists using JSONB query
		const { rows: existingUsers } = await pgClient.query(
			`SELECT user_id FROM users WHERE data->'personalInfo'->>'email' = $1`,
			[email.toLowerCase()],
		);

		if (existingUsers.length > 0) {
			return res
				.status(400)
				.json({ message: "User with this email already exists" });
		}

		// Generate unique user ID
		let unique = false;
		let userId;
		while (!unique) {
			userId = generateUniqueUserId();

			// Check if this user ID already exists
			const { rows: existingUserIds } = await pgClient.query(
				"SELECT user_id FROM users WHERE user_id = $1",
				[userId],
			);

			if (existingUserIds.length === 0) {
				unique = true;
			}
		}

		// Hash the password
		const hashedPassword = await bcrypt.hash(password, saltRounds);

		// Current timestamp for created/updated times
		const currentTimestamp = new Date().toISOString();

		// Create new user data object with the requested structure
		const userData = {
			userId,
			createdAt: currentTimestamp,
			updatedAt: currentTimestamp,
			status: "active",
			personalInfo: {
				firstName: first_name,
				lastName: last_name,
				email: email.toLowerCase(),
				phoneNumber: phone,
				dateOfBirth: date_of_birth || null,
				gender: gender || null,
			},
			securityCredentials: {
				hashed_password: hashedPassword,
				twoFactorEnabled: false,
				twoFactorMethod: null,
				lastPasswordChange: currentTimestamp,
				accountLocked: false,
			},
			notificationPreferences: {
				email: {
					marketing: true,
					orderUpdates: true,
					productRecommendations: true,
					accountAlerts: true,
				},
				sms: {
					marketing: false,
					orderUpdates: true,
					productRecommendations: false,
					accountAlerts: true,
				},
				push: {
					marketing: false,
					orderUpdates: true,
					productRecommendations: true,
					accountAlerts: true,
				},
			},
		};

		// Insert the new user into the database with JSONB data
		await pgClient.query(
			"INSERT INTO users (user_id, data) VALUES ($1, $2)",
			[userId, JSON.stringify(userData)],
		);

		// Generate access and refresh tokens
		const accessToken = generateToken();
		const refreshToken = generateToken();

		// Calculate expiration time for access token (12 hours)
		const accessTokenExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

		// Capture additional session details
		const clientType =
			req.headers["client-type"] === "app" ? "app" : "browser";
		const ipAddress =
			req.headers["x-forwarded-for"]?.split(",")[0] || req.ip;
		const userAgent = req.headers["user-agent"] || "unknown";

		// Create session data object
		const sessionData = {
			access_token: accessToken,
			refresh_token: refreshToken,
			client_type: clientType,
			ip_address: ipAddress,
			user_agent: userAgent,
			expires_at: accessTokenExpiresAt.toISOString(),
			refresh_expires_at: new Date(
				Date.now() + 7 * 24 * 60 * 60 * 1000,
			).toISOString(),
			is_valid: true,
			created_at: currentTimestamp,
		};

		// Store the session in the sessions table with JSONB data
		await pgClient.query(
			"INSERT INTO admin.sessions (id, user_id, data) VALUES ($1, $2, $3)",
			[crypto.randomUUID(), userId, JSON.stringify(sessionData)],
		);

		await pgClient.query("COMMIT"); // Commit transaction

		// Set cookies for the access and refresh tokens
		res.cookie("_ax_13z", accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "None",
			domain: ".citizenonlinestores.com",
			path: "/",
			maxAge: 12 * 60 * 60 * 1000, // 12 hours
		});

		res.cookie("_rf_9yp", refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "None",
			domain: ".citizenonlinestores.com",
			path: "/",
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		});

		res.cookie("_ax_13z", accessToken, {
			httpOnly: true,
			secure: false,
			sameSite: "Lax",
			domain: "localhost",
			path: "/",
			maxAge: 12 * 60 * 60 * 1000, // 12 hours
		});

		res.cookie("_rf_9yp", refreshToken, {
			httpOnly: true,
			secure: false,
			sameSite: "Lax",
			domain: "localhost",
			path: "/",
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		});

		// Return success response
		res.status(201).json({
			message: "User registered successfully",
			userId,
		});
	} catch (error) {
		await pgClient.query("ROLLBACK"); // Rollback transaction on error
		console.error("Error during signup:", error);
		res.status(500).json({ message: "Internal server error" });
	} finally {
		pgClient.release(); // Release client back to pool
	}
};
