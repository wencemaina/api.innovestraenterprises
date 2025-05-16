const express = require("express");
const router = express.Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
const { createJob } = require("../controllers/createJobController");
const { getAllJobs } = require("../controllers/getAllJobsController");

const { getEmployerJobs } = require("../controllers/getEmployerJobsController");

// Apply the multer middleware directly in the route
router.post("/create/new-job", upload.any(), createJob);

router.get("/all", getAllJobs);

router.get("/employer-jobs", getEmployerJobs);
module.exports = router;
