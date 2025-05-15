const express = require("express");
const router = express.Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
const { createJob } = require("../controllers/createJobController");
const { getAllJobs } = require("../controllers/getAllJobsController");

// Apply the multer middleware directly in the route
router.post("/create/new-job", upload.any(), createJob);

router.get("/all", getAllJobs);
module.exports = router;
