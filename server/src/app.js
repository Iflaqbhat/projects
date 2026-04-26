const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const expenseRoutes = require("./routes/expenseRoutes");

const app = express();

app.use(helmet());
app.use(
	cors({
		origin: "*",
		credentials: true,
	})
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
	res.status(200).json({ status: "ok", message: "Wallet Wise API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api", expenseRoutes);

app.use((req, res) => {
	res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
	console.error(err);
	res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
