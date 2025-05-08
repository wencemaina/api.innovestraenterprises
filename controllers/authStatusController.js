const pool = require("../db");

exports.checkAuthStatus = async (req, res) => {
	// Extract tokens from cookies
	const accessToken = req.cookies?._ax_13z;
	const refreshToken = req.cookies?._rf_9yp;

	console.log("Access token:", accessToken);
	console.log("Refresh token:", refreshToken);

	if (!accessToken || !refreshToken) {
		return res.status(401).json({ message: "Please log in to continue." });
	}

	try {
		// Query the sessions table using JSONB operators
		const query = `
      SELECT 
        user_id,
        data->>'expires_at' as expires_at,
        (data->>'is_valid')::boolean as is_valid
      FROM sessions
      WHERE data->>'access_token' = $1 
      AND data->>'refresh_token' = $2
    `;

		const { rows } = await pool.query(query, [accessToken, refreshToken]);

		if (rows.length === 0) {
			return res
				.status(401)
				.json({ message: "Invalid session. Please log in again." });
		}

		const { expires_at, is_valid, user_id } = rows[0];
		const currentTime = new Date();

		// If session is already invalid or expired, update is_valid to FALSE
		if (!is_valid || new Date(expires_at) < currentTime) {
			await pool.query(
				`
        UPDATE sessions 
        SET data = jsonb_set(data, '{is_valid}', 'false')
        WHERE data->>'access_token' = $1 
        AND data->>'refresh_token' = $2
      `,
				[accessToken, refreshToken],
			);

			return res
				.status(401)
				.json({ message: "Session expired. Please log in again." });
		}

		// If session is valid, return success response with user_id
		return res.status(200).json({
			message: "User is authenticated.",
			user_id: user_id,
		});
	} catch (error) {
		console.error("Error validating session:", error);
		return res.status(500).json({
			message: "Please try again later.",
			error:
				process.env.NODE_ENV === "production"
					? undefined
					: error.toString(),
		});
	}
};
