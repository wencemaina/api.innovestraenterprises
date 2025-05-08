const { getDb } = require("../db");

/**
 * Get all users with sensitive information filtered out
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.getAllUsers = async (req, res) => {
	try {
		const db = getDb();
		const usersCollection = db.collection("users");

		// Using toArray() is more efficient than manually creating an array with forEach
		const allUsers = await usersCollection.find({}).toArray();

		// Map the results to remove sensitive data and rename _id
		const users = allUsers.map((doc) => {
			const { securityCredentials, password, ...userData } = doc;
			return {
				user_id: doc._id,
				...userData,
			};
		});

		res.json(users);
	} catch (error) {
		console.error("Error fetching users:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

/**
 * Get a single user by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.getUserById = async (req, res) => {
	try {
		const userId = req.params.id;
		const db = getDb();
		const usersCollection = db.collection("users");

		// You may need to convert userId to ObjectId depending on your schema
		const user = await usersCollection.findOne({ _id: userId });

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Remove sensitive information
		const { securityCredentials, password, ...userData } = user;

		res.json({
			user_id: user._id,
			...userData,
		});
	} catch (error) {
		console.error(`Error fetching user ${req.params.id}:`, error);
		res.status(500).json({ error: "Internal server error" });
	}
};

/**
 * Create a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.createUser = async (req, res) => {
	try {
		const userData = req.body;
		const db = getDb();
		const usersCollection = db.collection("users");

		// You might want to validate the user data here

		const result = await usersCollection.insertOne(userData);

		res.status(201).json({
			user_id: result.insertedId,
			...userData,
		});
	} catch (error) {
		console.error("Error creating user:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
