import { pool } from "../db.js";
import { hmac } from "../crypto.js";
import { SERVER_HMAC_SECRET } from "../config.js";

export async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing_token" });

  const tokenHash = hmac(SERVER_HMAC_SECRET, token);
  const { rows } = await pool.query(
    "SELECT username, expires_at FROM admin_sessions WHERE token_hash = $1",
    [tokenHash]
  );
  const session = rows[0];
  if (!session || new Date(session.expires_at) < new Date()) {
    return res.status(401).json({ error: "session_expired" });
  }
  req.admin = { username: session.username };
  next();
}
