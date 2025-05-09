const { connectToMongo, getDb } = require("../db");

exports.logout = async (req, res) => {
	try {
		const accessToken = req.cookies?._ax_13z;

		if (!accessToken) {
			return res
				.status(400)
				.json({ message: "Access token is missing or invalid" });
		}

		await connectToMongo();
		const db = getDb();
		const sessionsCollection = db.collection("sessions");

		const result = await sessionsCollection.deleteOne({ accessToken });

		if (result.deletedCount === 0) {
			return res.status(404).json({ message: "Session not found" });
		}

		// Clear cookies for localhost
		res.clearCookie("_ax_13z", {
			httpOnly: true,
			sameSite: "Lax",
			secure: false,
			domain: "localhost",
			path: "/",
		});
		res.clearCookie("_rf_9yp", {
			httpOnly: true,
			sameSite: "Lax",
			secure: false,
			domain: "localhost",
			path: "/",
		});

		// Clear cookies for sitizenn.com
		res.clearCookie("_ax_13z", {
			httpOnly: true,
			sameSite: "None",
			secure: true,
			domain: ".sitizenn.com",
			path: "/",
		});
		res.clearCookie("_rf_9yp", {
			httpOnly: true,
			sameSite: "None",
			secure: true,
			domain: ".sitizenn.com",
			path: "/",
		});

		console.log("✅ User logged out successfully");
		res.status(200).json({ message: "Logout successful" });
	} catch (error) {
		console.error("💥 Error during logout:", error);
		res.status(500).json({ message: "An error occurred during logout" });
	}
};
