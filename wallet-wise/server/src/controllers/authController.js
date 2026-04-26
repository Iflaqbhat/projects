const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { createToken } = require("../utils/helpers");

const register = async (req, res) => {
	try {
		const { name, email, password } = req.body;

		if (!name || !email || !password) {
			return res.status(400).json({ error: "Name, email and password are required" });
		}

		const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
		if (existingUser.rows.length) {
			return res.status(409).json({ error: "Email already registered" });
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const result = await pool.query(
			`INSERT INTO users (name, email, password)
			 VALUES ($1, $2, $3)
			 RETURNING id, name, email, role`,
			[name, email, hashedPassword]
		);

		const user = result.rows[0];
		const token = createToken(user);

		return res.status(201).json({
			message: "User registered successfully",
			token,
			user,
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: "Internal server error" });
	}
};

const login = async (req, res) => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			return res.status(400).json({ error: "Email and password are required" });
		}

		const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
		if (!result.rows.length) {
			return res.status(401).json({ error: "Invalid credentials" });
		}

		const user = result.rows[0];
		const passwordMatch = await bcrypt.compare(password, user.password);

		if (!passwordMatch) {
			return res.status(401).json({ error: "Invalid credentials" });
		}

		const safeUser = {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
		};
		const token = createToken(safeUser);

		return res.status(200).json({
			message: "Login successful",
			token,
			user: safeUser,
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: "Internal server error" });
	}
};

const me = async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT id, name, email, role FROM users WHERE id = $1",
			[req.user.id]
		);

		if (!result.rows.length) {
			return res.status(404).json({ error: "User not found" });
		}

		return res.status(200).json({ user: result.rows[0] });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: "Internal server error" });
	}
};

module.exports = {
	register,
	login,
	me,
};
