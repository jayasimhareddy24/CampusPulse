const jwt = require("jsonwebtoken");

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Admin sign-in required." });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET || "development-only-change-me");
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

module.exports = { requireAdmin };
