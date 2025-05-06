const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Example route
app.get("/", (req, res) => {
	res.send("Welcome to innovestraenterprises.co.ke API");
});

// Start server
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
