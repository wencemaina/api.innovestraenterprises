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

/**
 * Delete a user account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.deleteUser = async (req, res) => {
	try {
		// Get user ID from cookie or params depending on your authorization strategy
		// Use cookie for authenticated user deleting their own account
		const authenticatedUserId = req.cookies["YwAsmAN"];
		// Use params for admin users who can delete any account by ID
		const targetUserId = req.params.id;

		// Validation: Check if the authenticated user is trying to delete their own account
		// or if they have admin privileges to delete other accounts
		// You can add admin check logic here if needed

		const db = getDb();
		const usersCollection = db.collection("users");

		// Determine which ID to use for deletion
		const idToDelete = targetUserId || authenticatedUserId;

		// Check if user exists before deletion
		const user = await usersCollection.findOne({
			userId: idToDelete,
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Delete the user
		const result = await usersCollection.deleteOne({
			userId: idToDelete,
		});

		if (result.deletedCount === 0) {
			return res
				.status(404)
				.json({ error: "User not found or already deleted" });
		}

		res.status(200).json({
			message: "User account deleted successfully",
			userId: idToDelete,
		});
	} catch (error) {
		console.error(`Error deleting user:`, error);
		res.status(500).json({ error: "Internal server error" });
	}
};

/**
 * Get currently authenticated user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.getCurrentUser = async (req, res) => {
	try {
		const userId = req.cookies["YwAsmAN"];
		if (!userId) {
			return res.status(401).json({ error: "Not authenticated" });
		}

		const db = getDb();
		const usersCollection = db.collection("users");

		const user = await usersCollection.findOne({ userId: userId });

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Remove sensitive information
		const { securityCredentials, ...userData } = user;

		res.json({
			user_id: user._id,
			...userData,
		});
	} catch (error) {
		console.error("Error fetching current user:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
