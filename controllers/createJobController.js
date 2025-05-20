const { getDb } = require("../db");
const crypto = require("crypto");

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

		// Generate a unique 8-character ID for the job
		const generateUniqueId = () => {
			// Generate a random buffer and convert to hex string
			return crypto.randomBytes(4).toString("hex");
		};

		let jobId;
		let isUnique = false;

		// Keep generating IDs until we find a unique one
		while (!isUnique) {
			jobId = generateUniqueId();
			// Check if this ID already exists in the database
			const existingJob = await jobsCollection.findOne({ id: jobId });
			if (!existingJob) {
				isUnique = true;
			}
		}

		console.log("🔑 Generated Unique Job ID:", jobId);

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

exports.updateJob = async (req, res) => {
	console.log("🔄 Received job update request");
	try {
		console.log("📝 Content-Type:", req.headers["content-type"]);
		// Get the job ID from the request parameters
		const { jobId } = req.params;
		if (!jobId) {
			console.error("❌ No job ID provided in request parameters");
			return res.status(400).json({
				status: "error",
				message: "Job ID is required",
			});
		}
		console.log("🔑 Updating job with ID:", jobId);

		// Safely check for body and files
		const formData = req.body || {};
		const files = req.files || [];
		console.log("📋 Form Fields (req.body):", formData);
		console.log("📎 Uploaded Files (req.files):", files);
		console.log(
			"🏷️ Updated Project Title:",
			formData.title || "No title provided",
		);
		console.log(
			"📄 Updated Project Description:",
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

		// First, retrieve the existing job to ensure it exists and belongs to the user
		const existingJob = await jobsCollection.findOne({ id: jobId });
		if (!existingJob) {
			console.error(`❌ Job with ID ${jobId} not found`);
			return res.status(404).json({
				status: "error",
				message: "Job not found",
			});
		}

		// Check if the user has permission to update this job
		if (existingJob.employerId !== employerId) {
			console.error(
				`⛔ User ${employerId} not authorized to update job ${jobId}`,
			);
			return res.status(403).json({
				status: "error",
				message: "You don't have permission to update this job",
			});
		}

		// Prepare the updated job object
		console.log("🧩 Assembling updated job data object...");
		const updatedJobData = {
			// Keep the original id
			id: jobId,
			title: formData.title || existingJob.title || "",
			description: formData.description || existingJob.description || "",
			briefDescription:
				formData.briefDescription || existingJob.briefDescription || "",
			budget: formData.budget || existingJob.budget || "",
			deadline: formData.deadline || existingJob.deadline || "",
			type: formData.type || existingJob.type || "Freelance Project",
			bids: parseInt(formData.bids || existingJob.bids || "0"),
			skills: Array.isArray(formData.skills)
				? formData.skills
				: existingJob.skills || [],
			category: formData.category || existingJob.category || "",
			priority: formData.priority || existingJob.priority || "",
			wordCount: formData.wordCount || existingJob.wordCount || "",
			visibility: formData.visibility || existingJob.visibility || "",
			// Preserve the original employerId
			employerId: employerId,
			// Status flags - update from form data or keep existing values
			isPublic:
				formData.isPublic === "true"
					? true
					: formData.isPublic === "false"
					? false
					: existingJob.isPublic,
			isPrivate:
				formData.isPrivate === "true"
					? true
					: formData.isPrivate === "false"
					? false
					: existingJob.isPrivate,
			isSubmitted:
				formData.isSubmitted === "true"
					? true
					: formData.isSubmitted === "false"
					? false
					: existingJob.isSubmitted,
			isComplete:
				formData.isComplete === "true"
					? true
					: formData.isComplete === "false"
					? false
					: existingJob.isComplete,
			isCompleteAndPaid:
				formData.isCompleteAndPaid === "true"
					? true
					: formData.isCompleteAndPaid === "false"
					? false
					: existingJob.isCompleteAndPaid,
			isCancelled:
				formData.isCancelled === "true"
					? true
					: formData.isCancelled === "false"
					? false
					: existingJob.isCancelled,
			isOverdue:
				formData.isOverdue === "true"
					? true
					: formData.isOverdue === "false"
					? false
					: existingJob.isOverdue,
			isInProgress:
				formData.isInProgress === "true"
					? true
					: formData.isInProgress === "false"
					? false
					: existingJob.isInProgress,
			isInRevision:
				formData.isInRevision === "true"
					? true
					: formData.isInRevision === "false"
					? false
					: existingJob.isInRevision,
			isDisputed:
				formData.isDisputed === "true"
					? true
					: formData.isDisputed === "false"
					? false
					: existingJob.isDisputed,
			// Initialize attachments array
			attachments: [],
			// Preserve original creation date, update the updated date
			createdAt: existingJob.createdAt,
			updatedAt: new Date(),
		};
		console.log("📝 Updated job data prepared");

		// Handle file attachments
		// If new files are provided, use them; otherwise, keep the existing attachments
		if (files && files.length > 0) {
			console.log(`📁 Processing ${files.length} new file(s)...`);
			for (const file of files) {
				const fileData = {
					filename: file.originalname,
					contentType: file.mimetype,
					size: file.size,
					uploadDate: new Date(),
					// Store the file data as Buffer in MongoDB
					data: file.buffer,
				};
				updatedJobData.attachments.push(fileData);
				console.log(
					`📎 Added new attachment: ${file.originalname} (${file.size} bytes)`,
				);
			}
			console.log(
				`✅ Successfully processed ${updatedJobData.attachments.length} new attachments`,
			);
		} else {
			// Keep existing attachments if no new files are uploaded
			console.log(
				"📄 No new files attached, keeping existing attachments",
			);
			updatedJobData.attachments = existingJob.attachments || [];
		}

		// Delete the old job document and insert the updated one
		console.log(`🗑️ Deleting job with ID: ${jobId}`);
		const deleteResult = await jobsCollection.deleteOne({ id: jobId });

		if (deleteResult.deletedCount !== 1) {
			console.error(`❌ Failed to delete job with ID: ${jobId}`);
			throw new Error("Failed to delete existing job document");
		}

		console.log("💾 Inserting updated job document into MongoDB...");
		const insertResult = await jobsCollection.insertOne(updatedJobData);

		if (insertResult.acknowledged) {
			console.log(
				`✅ Job updated successfully with _id: ${insertResult.insertedId}`,
			);
			// Return success response with updated job data
			console.log(
				`🚀 Sending success response for updated job ${updatedJobData.id}`,
			);
			res.status(200).json({
				status: "success",
				message: "Job updated successfully",
				data: {
					jobId: updatedJobData.id,
					title: updatedJobData.title,
					employerId: updatedJobData.employerId,
					attachmentsCount: updatedJobData.attachments.length,
					updatedAt: updatedJobData.updatedAt,
				},
			});
		} else {
			console.error("❌ MongoDB did not acknowledge the insertion");
			throw new Error("Failed to insert updated job document");
		}
	} catch (error) {
		console.error("❌ Error in updateJob:", error);
		console.error(`🚨 Stack trace: ${error.stack}`);
		res.status(500).json({
			status: "error",
			message: "Failed to update job",
			error: error.message,
		});
		console.log("📤 Sent error response to client");
	}
	console.log("✨ updateJob function execution completed");
};
