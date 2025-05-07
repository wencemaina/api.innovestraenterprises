const { Pool } = require("pg");

const connectionString =
	"postgres://postgres:oEM0Qcg5U38mi0mgaNPpOY7Igkiqo1g1p0swS7nxuYALblNsi4d1UcMfqMXo3Ogs@152.53.241.234:1233/postgres";

const dbConfig = {
	connectionString: connectionString,
	max: 20, // Max number of connections in the pool
	idleTimeoutMillis: 60000, // 60 seconds before closing idle connections
	connectionTimeoutMillis: 5000, // 5 seconds to wait for a new connection
	// Add retry logic
	retry_limit: 3,
	retry_delay: 1000,
};

const pool = new Pool(dbConfig);

// Connection management
const connectWithRetry = async () => {
	let retries = 0;

	while (retries < dbConfig.retry_limit) {
		try {
			const client = await pool.connect();
			await client.query("SELECT NOW()");
			client.release();
			console.log("Successfully connected to PostgreSQL database");
			return true;
		} catch (err) {
			retries++;
			console.error(`Connection attempt ${retries} failed:`, err.message);

			if (retries === dbConfig.retry_limit) {
				console.error(
					"Max connection retries reached. Please check if:",
				);
				console.error(
					"1. PostgreSQL service is running at the provided address and port",
				);
				console.error(
					"2. Database credentials in the connection string are correct",
				);
				console.error(
					'3. Database "postgres" (or the one specified in the connection string) exists',
				);
				console.error(
					"4. PostgreSQL is accepting connections on port 1233",
				);
				throw new Error(
					"Failed to connect to database after multiple attempts",
				);
			}

			// Wait before retrying
			await new Promise((resolve) =>
				setTimeout(resolve, dbConfig.retry_delay),
			);
		}
	}
};

// Error handling for the pool
pool.on("error", (err, client) => {
	console.error("Unexpected error on idle client:", err);
	if (client) {
		client.release(true); // Force release with error
	}
});

// Graceful shutdown
process.on("SIGINT", async () => {
	console.log("Closing pool connections...");
	try {
		await pool.end();
		console.log("Pool has ended");
		process.exit(0);
	} catch (err) {
		console.error("Error during pool shutdown:", err);
		process.exit(1);
	}
});

// Initialize connection
connectWithRetry().catch((err) => {
	console.error("Initial connection failed:", err);
	process.exit(1);
});

module.exports = pool;
