const { MongoClient } = require("mongodb");
require("dotenv").config(); // Load environment variables

// Get MongoDB URI from environment variable
const uri = process.env.MONGODB_URI;

// Create cached connection variables
let client;
let db;
let isConnecting = false;
let connectionPromise = null;

/**
 * Connects to MongoDB if not already connected
 * @returns {Promise<void>}
 */
const connectToMongo = async () => {
	// If we're already connected, return immediately
	if (db) {
		return;
	}

	// If connection is in progress, wait for it to complete
	if (isConnecting) {
		return connectionPromise;
	}

	isConnecting = true;
	connectionPromise = new Promise(async (resolve, reject) => {
		let retries = 0;
		const maxRetries = 3;
		const retryDelay = 1000;

		while (retries < maxRetries) {
			try {
				const options = {};
				client = new MongoClient(uri, options);
				await client.connect();

				// Test the connection with a simple command
				await client.db("admin").command({ ping: 1 });
				db = client.db("Innovdb");
				console.log("Connected to MongoDB");
				isConnecting = false;
				resolve();
				return;
			} catch (err) {
				retries++;
				console.error(
					`MongoDB connection attempt ${retries} failed: ${err.message}`,
				);

				if (retries === maxRetries) {
					console.error(
						"Max retries reached. Check URI or MongoDB service.",
					);
					isConnecting = false;
					reject(err);
					return;
				}

				await new Promise((r) => setTimeout(r, retryDelay));
			}
		}
	});

	return connectionPromise;
};

/**
 * Returns the database instance
 * @returns {object} MongoDB database instance
 */
const getDb = () => {
	if (!db) {
		throw new Error("Database not connected. Call connectToMongo first.");
	}
	return db;
};

/**
 * Closes the MongoDB connection
 * @returns {Promise<void>}
 */
const closeConnection = async () => {
	if (client) {
		await client.close();
		db = null;
		client = null;
		console.log("MongoDB connection closed");
	}
};

module.exports = {
	connectToMongo,
	getDb,
	closeConnection,
};
