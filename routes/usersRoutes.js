// routes/users.js

const express = require("express");
const router = express.Router();
const { getAllUsers } = require("../controllers/getAllUsers");

router.get("/all", getAllUsers);

module.exports = router;
