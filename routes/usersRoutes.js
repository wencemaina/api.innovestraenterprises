// routes/users.js

const express = require("express");
const router = express.Router();
const { getAllUsers } = require("../controllers/getAllUsers");

const { signUp } = require("../controllers/signupController");

router.get("/all", getAllUsers);

router.post("/user/register", signUp);

module.exports = router;
