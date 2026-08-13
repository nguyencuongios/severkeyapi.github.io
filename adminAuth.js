import { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool } from "../db.js";
import { verifyPassword, hmac, generateSessionToken } from "../crypto.js";
import { ADMIN_USERNAME, ADMIN_PASSWORD_HASH, SERVER_HMAC_SECRET, SESSION_TTL_MS } from "../config.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

// Tight limit on login attempts to slow down brute force / credential stuffing.
const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_attempts" },
});

router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "missing_fields" });

  // Always run verifyPassword so the response time doesn't leak whether the username exists.
  const validUsername = username === ADMIN_USERNAME;
  const ok = verifyPassword(password, ADMIN_PASSWORD_HASH) && validUsername;
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = generateSessionToken();
  const tokenHash = hmac(SERVER_HMAC_SECRET, token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await pool.query(
    "INSERT INTO admin_sessions (token_hash, username, expires_at) VALUES ($1,$2,$3)",
    [tokenHash, ADMIN_USERNAME, expiresAt]
  );

  res.json({ token, expiresAt });
});

router.post("/logout", requireAdmin, async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.slice(7);
  const tokenHash = hmac(SERVER_HMAC_SECRET, token);
  await pool.query("DELETE FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
  res.json({ ok: true });
});

export default router;
