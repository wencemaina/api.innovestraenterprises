const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { connectToMongo, getDb } = require("../db");

exports.signUp = async (req, res) => {
	console.log("Received signup request", req.body);
	try {
		const {
			email,
			password,
			name,
			phone,
			userType,
			confirmPassword,
			country,
			memberSince,
		} = req.body;

		if (
			!email?.trim() ||
			!password?.trim() ||
			!name?.trim() ||
			!phone?.trim() ||
			!userType?.trim() ||
			!confirmPassword?.trim() ||
			typeof email !== "string" ||
			!email.includes("@")
		) {
			return res.status(400).json({
				message: "Invalid input format. All fields are required.",
			});
		}

		if (password !== confirmPassword) {
			return res.status(400).json({ message: "Passwords do not match" });
		}

		await connectToMongo();
		const db = getDb();
		const usersCollection = db.collection("users");

		const existingUser = await usersCollection.findOne({
			"personalInfo.email": email.toLowerCase(),
		});

		if (existingUser) {
			return res
				.status(409)
				.json({ message: "Email already registered" });
		}

		const userId = uuidv4();
		const hashedPassword = await bcrypt.hash(password, 14);
		const now = new Date();

		const userData = {
			userId,
			personalInfo: {
				email: email.toLowerCase(),
				name,
				phone,
				avatar: null, // placeholder for image stored in DB
				bio: "",
				location: country?.trim() || "Kenya",
				languages: ["English"],
				timezone: "Africa/Nairobi",
			},
			securityCredentials: {
				hashed_password: hashedPassword,
				twoFactorEnabled: false,
			},
			userType,
			roles: [userType],
			status: "active",
			isVerified: false,
			joinedDate: now,
			lastLogin: null,
			loginHistory: [],
			notificationPreferences: {
				email: false,
				sms: false,
				inApp: true,
			},
			categories: [],
			experienceLevel: "",
			education: "",
			certifications: [],
			portfolio: [],
			writingSamples: [],
			jobsCompleted: 0,
			rating: 0,
			reviews: [],
			organizationName: "",
			preferredWriters: [],
			orderHistory: [],
			paymentInfo: {
				mpesaNumber: "",
				paymentMethod: "",
				paypalEmail: "",
				bankAccountDetails: {
					bankName: "",
					accountNumber: "",
					swiftCode: "",
				},
				pendingPayouts: 0,
				totalPaid: 0,
			},
			subscriptionPlan: "basic",
			subscriptionExpiresAt: null,
			paymentStatus: "inactive",
			referralCode: "",
			referredBy: "",
			supportTickets: [],
			interests: [],
			createdAt: now,
			updatedAt: now,
		};

		if (userType === "writer") {
			userData.writerProfile = {
				country: country?.trim() || "Kenya",
				memberSince: memberSince || now,
				completedJobs: 0,
				rating: 0,
			};
		}

		const result = await usersCollection.insertOne(userData);

		if (!result.acknowledged || !result.insertedId) {
			console.error("Failed to insert new user:", result);
			return res.status(500).json({
				message: "Failed to create user",
				error: "Insert failed",
			});
		}

		return res.status(201).json({
			message: "User created successfully",
			userId,
		});
	} catch (error) {
		console.error("Signup error:", error);
		return res.status(500).json({
			message: "Internal server error",
			error:
				process.env.NODE_ENV === "production"
					? "Internal server error"
					: error.toString(),
			stack: process.env.NODE_ENV === "production" ? null : error.stack,
		});
	}
};
