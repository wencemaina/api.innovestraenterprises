const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { connectToMongo, getDb } = require("../db"); // Adjust the path if needed

exports.signUp = async (req, res) => {
	console.log("Received signup request", req.body);
	try {
		const { email, password, name, phone, userType, confirmPassword } =
			req.body; // Destructure all required fields

		// Basic validation before hitting DB. Check for all required fields.
		if (
			!email?.trim() ||
			!password?.trim() ||
			!name?.trim() ||
			!phone?.trim() ||
			!userType?.trim() ||
			!confirmPassword?.trim() || // Added confirmPassword validation
			typeof email !== "string" ||
			!email.includes("@")
		) {
			return res.status(400).json({
				message: "Invalid input format. All fields are required.",
			});
		}

		// Check if password and confirmPassword match
		if (password !== confirmPassword) {
			return res.status(400).json({ message: "Passwords do not match" });
		}

		await connectToMongo(); // Ensure MongoDB connection
		const db = getDb();
		const usersCollection = db.collection("users");

		// Check if the email is already registered
		const existingUser = await usersCollection.findOne({
			"personalInfo.email": email.toLowerCase(), // Updated query path
		});

		if (existingUser) {
			return res
				.status(409)
				.json({ message: "Email already registered" }); // 409 Conflict
		}

		// Generate a unique user ID
		const userId = uuidv4();

		// Hash the password
		const hashedPassword = await bcrypt.hash(password, 14); // 10 is the salt rounds

		// Construct the user data object with proper structure
		const userData = {
			userId: userId,
			personalInfo: {
				email: email.toLowerCase(),
				name: name,
				phone: phone,
			},
			securityCredentials: {
				hashed_password: hashedPassword,
			},
			userType: userType,
			createdAt: new Date(),
			updatedAt: new Date(),
			status: "active",
		};

		// Insert the new user into the users collection (removed the "data" wrapper)
		const result = await usersCollection.insertOne(userData);

		// Check if the insertion was successful
		if (!result.acknowledged || !result.insertedId) {
			console.error("Failed to insert new user:", result);
			return res.status(500).json({
				message: "Failed to create user",
				error: "Insert failed",
			});
		}

		// Return success message and the new user's ID
		return res.status(201).json({
			// 201 Created
			message: "User created successfully",
			userId: userId,
		});
	} catch (error) {
		console.error("Signup error:", error);
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
