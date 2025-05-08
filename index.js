const express = require("express");
const { connectToMongo } = require("./db"); // Adjust path if needed

// Connect to MongoDB directly
connectToMongo();

const app = express();
const PORT = process.env.PORT || 3000;

const userRoutes = require("./routes/usersRoutes");

// Middleware to parse JSON
app.use(express.json());

// Example route
app.get("/", (req, res) => {
	res.send("Welcome to innovestraenterprises.co.ke API");
});

// Use the user routes
app.use("/api/users", userRoutes);

// Start server
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
