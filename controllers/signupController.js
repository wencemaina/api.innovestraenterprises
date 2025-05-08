const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { connectToMongo, getDb } = require("../db"); // Adjust the path if needed

exports.signUp = async (req, res) => {
	try {
		const { email, password, firstName, lastName } = req.body; // Destructure all required fields

		// Basic validation before hitting DB.  Check for all required fields.
		if (
			!email?.trim() ||
			!password?.trim() ||
			!firstName?.trim() ||
			!lastName?.trim() ||
			typeof email !== "string" ||
			!email.includes("@")
		) {
			return res
				.status(400)
				.json({
					message: "Invalid input format.  All fields are required.",
				});
		}

		await connectToMongo(); // Ensure MongoDB connection
		const db = getDb();
		const usersCollection = db.collection("users");

		// Check if the email is already registered
		const existingUser = await usersCollection.findOne({
			"data.personalInfo.email": email.toLowerCase(),
		});
		if (existingUser) {
			return res
				.status(409)
				.json({ message: "Email already registered" }); // 409 Conflict
		}

		// Hash the password
		const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

		// Generate a unique user ID.  Use MongoDB's default _id.
		// const userId = uuidv4();  // No need to generate, MongoDB does this.

		// Construct the user data object, mirroring your data structure
		const userData = {
			personalInfo: {
				email: email.toLowerCase(),
				firstName: firstName,
				lastName: lastName,
			},
			securityCredentials: {
				hashed_password: hashedPassword,
			},
			// Add any other default fields as necessary.  For example:
			createdAt: new Date(),
			updatedAt: new Date(),
			status: "active", // Or whatever your default status is
			role: "user", // Or default role
		};

		// Insert the new user into the users collection
		const result = await usersCollection.insertOne({ data: userData });

		// Check if the insertion was successful
		if (!result.acknowledged || !result.insertedId) {
			console.error("Failed to insert new user:", result);
			return res
				.status(500)
				.json({
					message: "Failed to create user",
					error: "Insert failed",
				});
		}
		const userId = result.insertedId; // Get the inserted ID.

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
