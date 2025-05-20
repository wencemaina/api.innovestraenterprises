const { getDb } = require("../db");

const crypto = require("crypto"); // Node.js built-in for generating IDs

/**
 * Generate a custom bid ID
 * Format: BID-{timestamp}-{random}
 * @returns {string} A unique bid identifier
 */
function generateBidId() {
	const timestamp = Date.now().toString(36); // Convert timestamp to base36
	const randomPart = crypto.randomBytes(4).toString("hex"); // Generate 8 random hex characters
	return `BID-${timestamp}-${randomPart}`.toUpperCase();
}

function generateBidId() {
	const timestamp = Date.now().toString(36); // Convert timestamp to base36
	const randomPart = crypto.randomBytes(4).toString("hex"); // Generate 8 random hex characters
	return `BID-${timestamp}-${randomPart}`.toUpperCase();
}

// Helper function to generate unique notification ID
function generateNotificationId() {
	return (
		"notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
	);
}

// Helper function to create notification objects
function createNotification(options) {
	const {
		type,
		title,
		description,
		userId,
		jobId,
		bidId,
		deliveryDays,
		bidAmount,
		isEmployer = false,
	} = options;

	const submissionTime = new Date();
	const notificationId = generateNotificationId();

	return {
		id: notificationId,
		type: type,
		title: title,
		description: description,
		time: submissionTime,
		isRead: false,
		userId: userId, // Changed from writerId to userId to be more generic
		userType: isEmployer ? "employer" : "writer", // Add user type to distinguish notifications
		jobId,
		bidId: bidId,
		bidAmount,
		deliveryDays,
		createdAt: submissionTime,
	};
}

exports.createJobBid = async (req, res) => {
	try {
		console.log("🔄 Received job bids request", req.body);
		// Extract writer ID from cookies
		const writerId = req.cookies["YwAsmAN"];
		if (!writerId) {
			return res.status(401).json({
				success: false,
				message: "Writer not authenticated",
			});
		}
		// Extract bid information from request body
		const { jobId, jobTitle, bidAmount, deliveryDays, notes } = req.body;
		// Validate required fields
		if (!jobId || !bidAmount || !deliveryDays) {
			return res.status(400).json({
				success: false,
				message: "Missing required bid information",
			});
		}
		// Get database connection
		const db = await getDb();
		// Fetch the writer's information to include in the bid
		const writer = await db
			.collection("users")
			.findOne({ userId: writerId });
		if (!writer) {
			return res.status(404).json({
				success: false,
				message: "Writer not found",
			});
		}

		// Fetch the job to get the employer ID
		const job = await db.collection("jobs").findOne({ id: jobId });
		if (!job) {
			return res.status(404).json({
				success: false,
				message: "Job not found",
			});
		}
		const employerId = job.employerId;

		// Check if a bid already exists for this writer and job
		const existingBid = await db.collection("bids").findOne({
			jobId,
			"writer.id": writerId,
		});
		// Create current timestamp for submission
		const submissionTime = new Date();
		// Create or update bid
		let bidId;
		let message;
		let statusCode = 201;
		let isNewBid = false;
		if (existingBid) {
			// Update existing bid
			bidId = existingBid.bidId;
			await db.collection("bids").updateOne(
				{ bidId },
				{
					$set: {
						bidAmount: `${bidAmount}`,
						deliveryTime: `${deliveryDays} days`,
						notes: notes,
						status: "pending", // Reset status to pending if it was something else
						submittedAt: submissionTime, // Update submission date
						updatedAt: submissionTime,
					},
				},
			);
			message = "Bid updated successfully";
			statusCode = 200;
		} else {
			// Generate custom bid ID for new bid
			bidId = generateBidId();
			isNewBid = true;
			// Create new bid object with writer information included
			const bid = {
				bidId: bidId,
				jobId,
				jobTitle,
				bidAmount: `${bidAmount}`,
				deliveryTime: `${deliveryDays} days`,
				notes: notes,
				writer: {
					id: writerId,
					name: writer.personalInfo.name,
					rating: writer.writerProfile?.rating || 0,
					completedJobs: writer.writerProfile?.completedJobs || 0,
					country: writer.writerProfile?.country || "Kenya",
				},
				status: "pending",
				submittedAt: submissionTime,
				createdAt: submissionTime,
			};
			// Store bid in database
			await db.collection("bids").insertOne(bid);
			message = "Bid submitted successfully";

			// Increment the bids count field in the JOBS collection (not the bids collection)
			try {
				// IMPORTANT: In the database the field is named "id" not "jobId"
				if (!job) {
					console.error(
						`❌ Job document not found in jobs collection for id: ${jobId}`,
					);
				} else {
					console.log(
						`Current 'bids' count in jobs collection for job ${jobId}: ${
							job.bids !== undefined ? job.bids : "undefined"
						}`,
					);

					// Update the bids field in the jobs collection using "id" field, not "jobId"
					const updateResult = await db
						.collection("jobs")
						.updateOne({ id: jobId }, { $inc: { bids: 1 } });

					if (updateResult.matchedCount === 0) {
						console.error(
							`❌ No job document matched in jobs collection with id: ${jobId}`,
						);
					} else if (updateResult.modifiedCount === 0) {
						console.error(
							`❌ Job document found in jobs collection but 'bids' field not updated for id: ${jobId}`,
						);

						// Fallback: If increment failed, try setting the value directly in the jobs collection
						const setResult = await db.collection("jobs").updateOne(
							{ id: jobId },
							{
								$set: {
									bids: job.bids ? parseInt(job.bids) + 1 : 1,
								},
							},
						);
						console.log(
							`Fallback update result for jobs collection: ${JSON.stringify(
								setResult,
							)}`,
						);
					} else {
						console.log(
							`✅ Job 'bids' count incremented in jobs collection for id: ${jobId}`,
						);
					}
				}
			} catch (bidUpdateError) {
				console.error(
					`❌ Error updating bid count in jobs collection:`,
					bidUpdateError,
				);
				// Continue execution - don't let bid count update failure stop the process
			}
		}

		// Create notifications array to store all notifications
		const notifications = [];

		// 1. Create notification for the writer
		const writerNotificationType = existingBid ? "bid_update" : "bid";
		const writerNotificationTitle = existingBid
			? "Bid Updated"
			: "New Bid Submitted";
		const writerNotificationDesc = existingBid
			? `You have updated your bid to ${bidAmount} for job: ${jobTitle}`
			: `You have submitted a bid of ${bidAmount} for job: ${jobTitle}`;

		const writerNotification = createNotification({
			type: writerNotificationType,
			title: writerNotificationTitle,
			description: writerNotificationDesc,
			userId: writerId,
			jobId,
			bidId,
			bidAmount,
			deliveryDays,
			isEmployer: false,
		});
		notifications.push(writerNotification);

		// 2. Create notification for the employer
		if (employerId) {
			const writerName = writer.personalInfo.name;
			const employerNotificationType = existingBid
				? "employer_bid_update"
				: "employer_new_bid";
			const employerNotificationTitle = existingBid
				? "Bid Updated"
				: "New Bid Received";
			const employerNotificationDesc = existingBid
				? `${writerName} has updated their bid to ${bidAmount} for your job: ${jobTitle}`
				: `${writerName} has submitted a bid of ${bidAmount} for your job: ${jobTitle}`;

			const employerNotification = createNotification({
				type: employerNotificationType,
				title: employerNotificationTitle,
				description: employerNotificationDesc,
				userId: employerId,
				jobId,
				bidId,
				bidAmount,
				deliveryDays,
				isEmployer: true,
			});
			notifications.push(employerNotification);
		} else {
			console.log(
				"⚠️ Employer ID not found, no employer notification created",
			);
		}

		// Store all notifications in the notifications collection
		if (notifications.length > 0) {
			await db.collection("notifications").insertMany(notifications);
			console.log(
				`✅ Created ${notifications.length} notifications for bid ${bidId}`,
			);
		}

		// Send success response
		res.status(statusCode).json({
			success: true,
			message,
			bidId,
		});
	} catch (error) {
		console.error("❌ Error processing bid:", error);
		res.status(500).json({
			success: false,
			message: "Failed to process bid",
		});
	}
};

exports.getJobBids = async (req, res) => {
	try {
		const jobId = req.params.jobId;
		console.log(`🔄 Received request to fetch bids for job: ${jobId}`);

		if (!jobId) {
			return res.status(400).json({
				success: false,
				message: "Job ID is required",
			});
		}

		// Extract writer ID from cookies for potential permission checks
		const writerId = req.cookies["YwAsmAN"];

		// Get database connection
		const db = await getDb();

		// Fetch all bids for the specific job
		const bids = await db
			.collection("bids")
			.find({ jobId: jobId })
			.sort({ createdAt: -1 }) // Sort by newest first
			.toArray();

		if (bids.length === 0) {
			console.log(`ℹ️ No bids found for job: ${jobId}`);
			return res.status(200).json({
				success: true,
				message: "No bids found for this job",
				bids: [],
			});
		}

		console.log(`✅ Found ${bids.length} bids for job: ${jobId}`);

		// Return the bids
		res.status(200).json({
			success: true,
			message: "Bids retrieved successfully",
			count: bids.length,
			bids: bids,
		});
	} catch (error) {
		console.error("❌ Error fetching job bids:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch job bids",
		});
	}
};

exports.acceptJobBid = async (req, res) => {
	try {
		console.log("🔄 Received job bid acceptance request", req.params);
		// Extract bid ID from request parameters
		const { bidId } = req.params;
		if (!bidId) {
			return res.status(400).json({
				success: false,
				message: "Bid ID is required",
			});
		}

		// Extract employer ID from cookies (assuming employers are authenticated similarly to writers)
		const employerId = req.cookies["YwAsmAN"]; // Adjust cookie name as needed
		if (!employerId) {
			return res.status(401).json({
				success: false,
				message: "Employer not authenticated",
			});
		}

		// Get database connection
		const db = await getDb();

		// Find the bid to update using the string bidId (not ObjectId)
		const bid = await db.collection("bids").findOne({
			bidId: bidId,
		});

		if (!bid) {
			return res.status(404).json({
				success: false,
				message: "Bid not found",
			});
		}

		// Check if the bid is already accepted (optional validation)
		if (bid.status === "accepted") {
			return res.status(400).json({
				success: false,
				message: "This bid has already been accepted",
			});
		}

		// Update bid status to accepted, using bidId string
		await db.collection("bids").updateOne(
			{ bidId: bidId },
			{
				$set: {
					status: "accepted",
					acceptedAt: new Date(),
					acceptedBy: employerId,
				},
			},
		);

		// Mark all other bids for this job as declined
		await db.collection("bids").updateMany(
			{
				jobId: bid.jobId,
				bidId: { $ne: bidId }, // Not equal to the current bid
			},
			{
				$set: {
					status: "declined",
					declinedAt: new Date(),
					declinedBy: employerId,
				},
			},
		);

		console.log("✅ Other bids for this job marked as declined");

		// Update job status to isInProgress: true
		await db.collection("jobs").updateOne(
			{ jobId: bid.jobId },
			{
				$set: {
					isInProgress: true,
				},
			},
		);

		console.log("✅ Job status updated to in progress for job:", bid.jobId);

		// Get employer information for notification
		const employer = await db
			.collection("users")
			.findOne({ userId: employerId });
		const employerName = employer?.personalInfo?.name || "Employer";

		// Generate notification IDs
		const writerNotificationId = generateNotificationId();
		const employerNotificationId = generateNotificationId();

		// Create notification for the writer
		const writerNotification = {
			id: writerNotificationId,
			type: "bid_accepted",
			title: "Bid Accepted",
			description: `Your bid of ${bid.bidAmount} for job: ${bid.jobTitle} has been accepted!`,
			time: new Date(),
			isRead: false,
			writerId: bid.writer.id,
			employerId,
			jobId: bid.jobId,
			bidId: bid.bidId,
			createdAt: new Date(),
		};

		// Create notification for the employer
		const employerNotification = {
			id: employerNotificationId,
			type: "bid_accepted",
			title: "Bid Acceptance Confirmed",
			description: `You have accepted ${bid.writer.name}'s bid of ${bid.bidAmount} for job: ${bid.jobTitle}`,
			time: new Date(),
			isRead: false, // Changed from 'read' to 'isRead'
			employerId,
			writerId: bid.writer.id,
			jobId: bid.jobId,
			bidId: bid.bidId, // Use bidId string
			createdAt: new Date(),
		};

		// Create notifications for other freelancers whose bids were declined
		const declinedBids = await db
			.collection("bids")
			.find({
				jobId: bid.jobId,
				bidId: { $ne: bidId },
			})
			.toArray();

		const declinedNotifications = declinedBids.map((declinedBid) => ({
			id: generateNotificationId(), // Unique ID for each declined notification
			type: "bid_declined",
			title: "Bid Declined",
			description: `Your bid of ${declinedBid.bidAmount} for job: ${declinedBid.jobTitle} has been declined.`,
			time: new Date(),
			isRead: false, // Changed from 'read' to 'isRead'
			writerId: declinedBid.writer.id,
			employerId,
			jobId: declinedBid.jobId,
			bidId: declinedBid.bidId,
			createdAt: new Date(),
		}));

		// Store all notifications in the database
		await db
			.collection("notifications")
			.insertMany([
				writerNotification,
				employerNotification,
				...declinedNotifications,
			]);

		console.log(
			`✅ Notifications created for bid acceptance (writer: ${writerNotificationId}, employer: ${employerNotificationId}) and ${declinedNotifications.length} declined bids`,
		);

		// Send success response
		res.status(200).json({
			success: true,
			message: "Bid accepted successfully",
			bid: {
				...bid,
				status: "accepted",
				acceptedAt: new Date(),
			},
		});
	} catch (error) {
		console.error("❌ Error accepting bid:", error);
		res.status(500).json({
			success: false,
			message: "Failed to accept bid",
		});
	}
};

exports.getAcceptedBids = async (req, res) => {
	try {
		// Either get bids accepted by a specific employer or bids of a specific writer that were accepted
		const { employerId, writerId } = req.query;

		if (!employerId && !writerId) {
			return res.status(400).json({
				success: false,
				message: "Either employerId or writerId is required",
			});
		}

		// Get database connection
		const db = await getDb();

		// Prepare query based on provided parameters
		const query = { status: "accepted" };

		if (employerId) {
			query.acceptedBy = employerId;
		}

		if (writerId) {
			query["freelancer.id"] = writerId;
		}

		// Fetch accepted bids
		const acceptedBids = await db
			.collection("bids")
			.find(query)
			.sort({ acceptedAt: -1 })
			.toArray();

		console.log(`✅ Found ${acceptedBids.length} accepted bids`);

		// Return the accepted bids
		res.status(200).json({
			success: true,
			message: "Accepted bids retrieved successfully",
			count: acceptedBids.length,
			bids: acceptedBids,
		});
	} catch (error) {
		console.error("❌ Error fetching accepted bids:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch accepted bids",
		});
	}
};

exports.getUserBids = async (req, res) => {
	try {
		// Get the writerId from the cookie
		const writerId = req.cookies["YwAsmAN"];

		if (!writerId) {
			return res.status(401).json({
				success: false,
				message: "User not authenticated or cookie missing",
			});
		}

		// Get database connection
		const db = await getDb();

		// Fetch bids where the user is the writer
		const userBids = await db
			.collection("bids")
			.find({ "writer.id": writerId })
			.sort({ createdAt: -1 })
			.toArray();

		// If no bids found, return empty array
		if (!userBids.length) {
			return res.status(200).json({
				success: true,
				message: "No bids found for this user",
				count: 0,
				bids: [],
			});
		}

		// Extract job IDs to fetch job details
		const jobIds = userBids.map((bid) => bid.jobId);

		// Fetch job details for all the bid jobs
		const jobs = await db
			.collection("jobs")
			.find({ jobId: { $in: jobIds } })
			.toArray();

		// Create a map of jobId to job description for quick lookup
		const jobDetailsMap = {};
		jobs.forEach((job) => {
			jobDetailsMap[job.jobId] = job.description || "";
		});

		// Format bids with job descriptions and in the requested structure
		const formattedBids = userBids.map((bid) => {
			return {
				id: bid._id,
				bidId: bid.bidId,
				jobId: bid.jobId,
				jobTitle: bid.jobTitle,
				budget: bid.budget || "Not specified",
				bidAmount: `$${bid.bidAmount}`,
				deliveryTime: bid.deliveryTime,
				bidDate: new Date(bid.submittedAt).toLocaleDateString("en-US", {
					year: "numeric",
					month: "short",
					day: "numeric",
				}),
				status:
					bid.status.charAt(0).toUpperCase() + bid.status.slice(1), // Capitalize status
				jobDescription:
					jobDetailsMap[bid.jobId] || "No description available",
				notes: bid.notes || "",
			};
		});

		console.log(
			`✅ Found and formatted ${formattedBids.length} bids for user ${writerId}`,
		);
		console.log(formattedBids);
		// Return the formatted bids
		res.status(200).json({
			success: true,
			message: "User bids retrieved successfully",
			count: formattedBids.length,
			bids: formattedBids,
		});
	} catch (error) {
		console.error("❌ Error fetching user bids:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch user bids",
			error: error.message,
		});
	}
};

exports.getEmployerBids = async (req, res) => {
	try {
		// Get the employerId from the cookie
		const employerId = req.cookies["YwAsmAN"];
		if (!employerId) {
			return res.status(401).json({
				success: false,
				message: "User not authenticated or cookie missing",
			});
		}

		// Get database connection
		const db = await getDb();

		// Fetch jobs where the user is the employer
		const employerJobs = await db
			.collection("jobs")
			.find({ employerId: employerId })
			.sort({ createdAt: -1 })
			.toArray();

		// If no jobs found, return empty array
		if (!employerJobs.length) {
			return res.status(200).json({
				success: true,
				message: "No jobs found for this employer",
				count: 0,
				jobsWithBids: [],
			});
		}

		// Extract job IDs to fetch bid details
		const jobIds = employerJobs.map((job) => job.id);

		// Fetch all bids for those job IDs
		const allBids = await db
			.collection("bids")
			.find({ jobId: { $in: jobIds } })
			.toArray();

		// Group bids by jobId
		const bidsByJob = {};
		allBids.forEach((bid) => {
			if (!bidsByJob[bid.jobId]) {
				bidsByJob[bid.jobId] = [];
			}
			bidsByJob[bid.jobId].push(bid);
		});

		// Format jobs with their respective bids in the requested structure
		const jobsWithBids = employerJobs.map((job) => {
			const jobBids = bidsByJob[job.id] || [];

			// Format each bid for this job
			const formattedProposals = jobBids.map((bid) => {
				return {
					id: bid._id,
					writer: {
						name: bid.writer.name,
						rating: bid.writer.rating,
						completedJobs: bid.writer.completedJobs,
						avatar: null, // Placeholder as this isn't in your schema
					},
					amount: `$${bid.bidAmount}`,
					deliveryTime: bid.deliveryTime,
					status:
						bid.status.charAt(0).toUpperCase() +
						bid.status.slice(1), // Capitalize status
					proposal: bid.notes || "",
					attachments: [], // Placeholder as this isn't in your schema
				};
			});

			return {
				jobId: job.id,
				jobTitle: job.title,
				budget: `$${job.budget}`,
				deadline: new Date(job.deadline).toLocaleDateString("en-US", {
					year: "numeric",
					month: "long",
					day: "numeric",
				}),
				proposals: formattedProposals,
			};
		});

		// Filter out jobs with no bids if needed
		const jobsWithBidsFiltered = jobsWithBids.filter(
			(job) => job.proposals.length > 0,
		);

		console.log(
			`✅ Found ${jobsWithBidsFiltered.length} jobs with bids for employer ${employerId}`,
		);

		// Return the formatted jobs with bids
		res.status(200).json({
			success: true,
			message: "Employer jobs with bids retrieved successfully",
			count: jobsWithBidsFiltered.length,
			jobsWithBids: jobsWithBidsFiltered,
		});
	} catch (error) {
		console.error("❌ Error fetching employer bids:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch employer bids",
			error: error.message,
		});
	}
};
