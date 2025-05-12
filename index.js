const express = require("express");
const { connectToMongo } = require("./db");
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require("cors");

const cookieParser = require("cookie-parser");
app.use(cookieParser());

// Connect to MongoDB directly
connectToMongo();

app.use(
	cors({
		origin: [
			"http://localhost:3000",
			"http://localhost:3001",

			"https://innovestraenterprises.co.ke",
			"http://innovestraenterprises.co.ke",
			"https://www.innovestraenterprises.co.ke",
			"http://www.innovestraenterprises.co.ke",
			"https://api.innovestraenterprises.co.ke",
		],
		methods: ["GET", "POST", "PUT", "DELETE"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Refresh-Token"],
		credentials: true,
		exposedHeaders: ["Set-Cookie"],
	}),
);

const userRoutes = require("./routes/usersRoutes");

const authRoutes = require("./routes/authRoutes");

// Middleware to parse JSON
app.use(express.json());

// Example route
app.get("/", (req, res) => {
	res.send("Welcome to innovestraenterprises.co.ke API");
});

// Use the user routes
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);

// Start server
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});

/* app.listen(PORT, "0.0.0.0", () => {
	console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
 */
