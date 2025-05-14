const bcrypt = require("bcrypt");
const { connectToMongo, getDb } = require("../db");

exports.resetPassword = async (req, res) => {
	const { token, newPassword } = req.body;
	console.log(`[INFO] Received password reset request with token: ${token}`);

	try {
		await connectToMongo();
		const db = getDb();
		const tokens = db.collection("password_reset_tokens");
		const users = db.collection("users");

		const tokenDoc = await tokens.findOne({ token });

		if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
			console.log(`[WARN] Invalid or expired token`);
			return res
				.status(400)
				.json({ message: "Invalid or expired token" });
		}

		const user = await users.findOne({
			"personalInfo.email": tokenDoc.email,
		});
		if (!user) {
			console.log(`[ERROR] No user found with email: ${tokenDoc.email}`);
			return res.status(404).json({ message: "User not found" });
		}

		const hashedPassword = await bcrypt.hash(newPassword, 14);
		const result = await users.updateOne(
			{ userId: user.userId },
			{
				$set: {
					"securityCredentials.hashed_password": hashedPassword,
					updatedAt: new Date(),
				},
			},
		);

		if (result.modifiedCount === 0) {
			console.log(
				`[ERROR] Failed to update password for ${tokenDoc.email}`,
			);
			return res
				.status(500)
				.json({ message: "Failed to update password" });
		}

		await tokens.deleteOne({ token });
		console.log(
			`[INFO] Password updated and token deleted for: ${tokenDoc.email}`,
		);

		res.status(200).json({
			message: "Password has been reset successfully",
		});
	} catch (error) {
		console.error("[ERROR] resetPassword:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};
