// routes/users.js

const express = require("express");
const router = express.Router();
const {
	getAllUsers,
	getCurrentUser,
	deleteUser,
} = require("../controllers/allUsersController");

const { signUp } = require("../controllers/signupController");
const { login } = require("../controllers/loginController");

router.get("/all", getAllUsers);

router.post("/user/register", signUp);

router.post("/user/login", login);

router.get("/user/account", getCurrentUser);

router.delete("/user/delete/:userId", deleteUser);

module.exports = router;
