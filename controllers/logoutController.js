const db = require("../db");

exports.logout = async (req, res) => {
	try {
		// Extract the access token from cookies
		const access_token = req.cookies?._ax_13z;

		if (!access_token) {
			return res
				.status(400)
				.json({ message: "Access token is missing or invalid" });
		}

		// Delete sessions where the access_token matches in the JSONB data
		const deleteQuery = `
            DELETE FROM admin.sessions 
            WHERE data->>'access_token' = $1 
            RETURNING id
        `;

		const result = await db.query(deleteQuery, [access_token]);

		if (result.rowCount === 0) {
			// No sessions were found related to the provided token
			return res.status(404).json({ message: "Session not found" });
		}

		// Clear the access token cookie
		res.clearCookie("_ax_13z", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
		});

		// Successfully deleted session and cleared the cookie
		res.status(200).json({ message: "Logout successful" });
		console.log("User logged out successfully");
	} catch (error) {
		console.error("Error during logout:", error);
		res.status(500).json({ message: "An error occurred during logout" });
	}
};
