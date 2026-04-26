const dotenv = require("dotenv");

dotenv.config({ override: true });

const app = require("./app");
const pool = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
	try {
		await pool.query("SELECT 1");
		console.log("Database connected successfully");

		app.listen(PORT, () => {
			console.log(`Server listening on port ${PORT}`);
		});
	} catch (error) {
		console.error("Failed to start server:", error.message);
		process.exit(1);
	}
};

startServer();
