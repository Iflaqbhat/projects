const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
	try {
		const header = req.headers.authorization;

		if (!header || !header.startsWith("Bearer ")) {
			return res.status(401).json({ error: "Unauthorized: token missing" });
		}

		const token = header.split(" ")[1];
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.user = decoded;

		return next();
	} catch (error) {
		return res.status(401).json({ error: "Unauthorized: invalid token" });
	}
};

module.exports = auth;
