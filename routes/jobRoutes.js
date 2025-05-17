const express = require("express");
const router = express.Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
const { createJob } = require("../controllers/createJobController");
const { getAllJobs } = require("../controllers/getAllJobsController");

const { getEmployerJobs } = require("../controllers/getEmployerJobsController");

const { getJobById } = require("../controllers/getJobByIdController");

const {
	getAllWriterJobs,
} = require("../controllers/getAllWriterJobsController");

const { jobBids } = require("../controllers/jobBidsController");

const { checkJobBid } = require("../controllers/checkBidsController");

const {
	getAllNotifications,
} = require("../controllers/getAllNotificationsController");
// Apply the multer middleware directly in the route
router.post("/create/new-job", upload.any(), createJob);

router.get("/all", getAllJobs);

router.get("/employer-jobs", getEmployerJobs);

router.get("/all-writer-jobs", getAllWriterJobs);

router.get("/job-by-id/:id", getJobById);

router.post("/job-bids", jobBids);

router.get("/check-job-bid/:jobId", checkJobBid);

router.get("/notifications", getAllNotifications);

module.exports = router;
