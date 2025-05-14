const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { connectToMongo, getDb } = require("../db");

exports.requestPasswordReset = async (req, res) => {
	const { email } = req.body;
	console.log(`[INFO] Password reset requested for: ${email}`);
	try {
		await connectToMongo();
		const db = getDb();
		const users = db.collection("users");
		const tokens = db.collection("password_reset_tokens");

		// Find user using nested email path
		const user = await users.findOne({ "personalInfo.email": email });
		if (!user) {
			console.log(`[WARN] No user found with email: ${email}`);
			return res.status(404).json({ message: "User not found" });
		}

		// Generate token and expiration
		const token = crypto.randomBytes(32).toString("hex");
		const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour

		// Save token
		await tokens.insertOne({ email, token, expiresAt });
		console.log(`[INFO] Token stored for ${email}: ${token}`);

		// Setup SMTP with Brevo
		const transporter = nodemailer.createTransport({
			host: "smtp-relay.brevo.com",
			port: 587,
			secure: false,
			auth: {
				user: "8cfcd0001@smtp-brevo.com", // your Brevo SMTP username
				pass: "8Zd7LSUWVQ5nCycv", // your Brevo SMTP password
			},
		});

		// Send reset link
		const resetLink = `https://innovestraenterprises.co.ke/set-new-password?token=${token}`;
		const mailOptions = {
			from: '"Innovestra Enterprises" <noreply@innovestraenterprises.co.ke>', // Your verified sender
			to: email,
			subject: "Password Reset Request",
			text: `To reset your password, click the following link: ${resetLink}`,
			html: `<p>To reset your password, click the following link:</p><a href="${resetLink}">${resetLink}</a>`,
		};

		await transporter.sendMail(mailOptions);
		console.log(`[INFO] Password reset email sent to: ${email}`);
		res.status(200).json({ message: "Password reset email sent" });
	} catch (error) {
		console.error("[ERROR] requestPasswordReset:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};
