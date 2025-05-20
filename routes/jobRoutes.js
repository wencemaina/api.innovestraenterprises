const express = require("express");
const router = express.Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });

const { createJob, updateJob } = require("../controllers/createJobController");
const { getAllJobs } = require("../controllers/getAllJobsController");

const { getEmployerJobs } = require("../controllers/getEmployerJobsController");

const {
	getAllWriterJobs,
} = require("../controllers/getAllWriterJobsController");

const {
	getJobBids,
	createJobBid,
	acceptJobBid,
	getAcceptedBids,
	getUserBids,
	getEmployerBids,
	declineJobBid,
	getAllWriterBids,
} = require("../controllers/jobBidsController");

const { checkJobBid } = require("../controllers/checkBidsController");

const { getJobById } = require("../controllers/getAllJobsController");

// Apply the multer middleware directly in the route
router.post("/create/new-job", upload.any(), createJob);

router.get("/all", getAllJobs);

router.get("/employer-jobs", getEmployerJobs);

router.get("/all-writer-jobs", getAllWriterJobs);

router.post("/job-bids", createJobBid);

router.get("/check-job-bid/:jobId", checkJobBid);

router.get("/all-writer-bids", getAllWriterBids);

router.get("/job-by-id/:jobId", getJobById);

router.get("/job-bids/:jobId", getJobBids);

router.post("/bids/accept/:bidId", acceptJobBid);

router.post("/bids/decline/:bidId", declineJobBid);

router.put("/update-job/:jobId", upload.any(), updateJob);

router.get("/bids/get-employer-bids", getEmployerBids);

module.exports = router;
