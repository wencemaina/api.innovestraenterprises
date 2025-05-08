// routes/users.js

const express = require("express");
const router = express.Router();
const { getAllUsers } = require("../controllers/getAllUsers");

const { signUp } = require("../controllers/signupController");
const { login } = require("../controllers/loginController");

router.get("/all", getAllUsers);

router.post("/user/register", signUp);

router.post("/user/login", login);

module.exports = router;
