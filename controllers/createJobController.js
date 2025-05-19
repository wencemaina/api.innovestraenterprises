const { getDb } = require("../db");

exports.createJob = async (req, res) => {
	console.log("🔄 Received job creation request");
	try {
		console.log("📝 Content-Type:", req.headers["content-type"]);
		// Safely check for body and files
		const formData = req.body || {};
		const files = req.files || [];
		console.log("📋 Form Fields (req.body):", formData);
		console.log("📎 Uploaded Files (req.files):", files);
		console.log("🏷️ Project Title:", formData.title || "No title provided");
		console.log(
			"📄 Project Description:",
			formData.description || "No description provided",
		);

		// Extract the userId from the YwAsmAN cookie
		const cookies = req.cookies || {};
		console.log("🍪 All cookies:", cookies);
		const employerId = cookies.YwAsmAN || null;
		console.log(
			"👤 Employer ID from cookie:",
			employerId || "⚠️ No employerId found in cookie!",
		);

		// Get database connection
		console.log("🔌 Connecting to database...");
		const db = getDb();
		const jobsCollection = db.collection("jobs");
		console.log("📚 Connected to jobs collection");

		// Generate a unique ID for the job
		const jobsCount = await jobsCollection.countDocuments();
		const jobId = (jobsCount + 1).toString();
		console.log("🔑 Generated Job ID:", jobId);

		// Prepare the job object
		console.log("🧩 Assembling job data object...");
		const jobData = {
			id: jobId,
			title: formData.title || "",
			description: formData.description || "",
			briefDescription: formData.briefDescription || "",
			budget: formData.budget || "",
			deadline: formData.deadline || "",
			type: formData.type || "Freelance Project",
			bids: parseInt(formData.bids || "0"),
			skills: Array.isArray(formData.skills) ? formData.skills : [],
			category: formData.category || "",
			priority: formData.priority || "",
			wordCount: formData.wordCount || "",
			visibility: formData.visibility || "",
			// Add the employerId from the cookie
			employerId: employerId,
			// Status flags - all initialized to false except those explicitly set
			isPublic: formData.isPublic === "true",
			isPrivate: formData.isPrivate === "true",
			isSubmitted: false,
			isComplete: false,
			isCompleteAndPaid: false,
			isCancelled: false,
			isOverdue: false,
			isInProgress: false,
			isInRevision: false,
			isDisputed: false,
			// File attachment will be added if present
			attachments: [],
			// Add timestamps
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		console.log("📝 Job data prepared:", jobData);

		// Handle file attachments if present
		if (files && files.length > 0) {
			console.log(`📁 Processing ${files.length} file(s)...`);
			for (const file of files) {
				const fileData = {
					filename: file.originalname,
					contentType: file.mimetype,
					size: file.size,
					uploadDate: new Date(),
					// Store the file data as Buffer in MongoDB
					data: file.buffer,
				};
				jobData.attachments.push(fileData);
				console.log(
					`📎 Added attachment: ${file.originalname} (${file.size} bytes)`,
				);
			}
			console.log(
				`✅ Successfully processed ${jobData.attachments.length} attachments`,
			);
		} else {
			console.log("📄 No files attached to this job");
		}

		// Insert the job document into MongoDB
		console.log("💾 Creating new job document in MongoDB...");
		const result = await jobsCollection.insertOne(jobData);
		if (result.acknowledged) {
			console.log(
				`✅ Job created successfully with _id: ${result.insertedId}`,
			);
			// Return success response with job data
			console.log(`🚀 Sending success response for job ${jobData.id}`);
			res.status(201).json({
				status: "success",
				message: "Job created successfully",
				data: {
					jobId: jobData.id,
					title: jobData.title,
					employerId: jobData.employerId,
					attachmentsCount: jobData.attachments.length,
				},
			});
		} else {
			console.error("❌ MongoDB did not acknowledge the insertion");
			throw new Error("Failed to insert job document");
		}
	} catch (error) {
		console.error("❌ Error in createJob:", error);
		console.error(`🚨 Stack trace: ${error.stack}`);
		res.status(500).json({
			status: "error",
			message: "Failed to create job",
			error: error.message,
		});
		console.log("📤 Sent error response to client");
	}
	console.log("✨ createJob function execution completed");
};
