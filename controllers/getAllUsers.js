const pool = require("../db");

exports.getAllUsers = async (req, res) => {
	try {
		const query = "SELECT user_id, data FROM users";
		const { rows } = await pool.query(query);

		// Combine user_id with data while excluding securityCredentials
		const users = rows.map((row) => {
			const userData = { ...row.data }; // Create copy of the JSONB data

			// Remove securityCredentials from the data
			if (userData.securityCredentials) {
				delete userData.securityCredentials;
			}

			return {
				user_id: row.user_id,
				...userData,
			};
		});

		res.json(users);
	} catch (error) {
		console.error("Error fetching users:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
