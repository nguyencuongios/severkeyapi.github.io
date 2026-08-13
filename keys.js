import { Router } from "express";
import { pool } from "../db.js";
import { generateApiKey, hmac } from "../crypto.js";
import { SERVER_HMAC_SECRET } from "../config.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAdmin);

const DURATION_MS = {
  "1d": 24 * 3600 * 1000,
  "3d": 3 * 24 * 3600 * 1000,
  "7d": 7 * 24 * 3600 * 1000,
  "1th": 30 * 24 * 3600 * 1000,
  "3th": 90 * 24 * 3600 * 1000,
  "1nam": 365 * 24 * 3600 * 1000,
};

router.get("/", async (req, res) => {
  const { package_id, search, revoked } = req.query;
  const conds = [];
  const values = [];
  if (package_id) {
    values.push(package_id);
    conds.push(`k.package_id = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    conds.push(`k.name ILIKE $${values.length}`);
  }
  if (revoked === "true") conds.push("k.revoked = true");

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT k.id, k.package_id, p.name AS package_name, k.name, k.key_prefix,
            k.max_uses, k.used_count, k.revoked, k.note, k.created_at, k.expires_at,
            (k.device_hash IS NOT NULL) AS device_bound
     FROM api_keys k
     JOIN packages p ON p.id = k.package_id
     ${where}
     ORDER BY k.created_at DESC`,
    values
  );
  res.json(rows);
});

// Key is generated server-side with crypto.randomBytes and returned in plaintext
// exactly once, in this response. Only the HMAC hash and a short prefix are stored.
router.post("/", async (req, res) => {
  const { package_id, duration, max_uses = 1, name } = req.body || {};
  if (!package_id || !DURATION_MS[duration]) return res.status(400).json({ error: "invalid_input" });

  const plaintext = generateApiKey();
  const keyHash = hmac(SERVER_HMAC_SECRET, plaintext);
  const prefix = plaintext.slice(0, 12);
  const expiresAt = new Date(Date.now() + DURATION_MS[duration]);
  const keyName = (name && name.trim()) || `KEY-${prefix.slice(-4).toUpperCase()}`;

  const { rows } = await pool.query(
    `INSERT INTO api_keys (package_id, name, key_prefix, key_hash, max_uses, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, package_id, name, key_prefix, max_uses, used_count, revoked, note, created_at, expires_at`,
    [package_id, keyName, prefix, keyHash, Math.max(1, Number(max_uses) || 1), expiresAt]
  );

  res.status(201).json({ ...rows[0], key: plaintext, device_bound: false });
});

router.post("/purge", async (req, res) => {
  await pool.query("DELETE FROM api_keys");
  res.json({ ok: true });
});

router.post("/:id/revoke", async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE api_keys SET revoked = NOT revoked WHERE id = $1 RETURNING revoked",
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "not_found" });
  res.json({ revoked: rows[0].revoked });
});

router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM api_keys WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

router.put("/:id/note", async (req, res) => {
  const { note = "" } = req.body || {};
  await pool.query("UPDATE api_keys SET note = $1 WHERE id = $2", [note, req.params.id]);
  res.json({ ok: true });
});

router.get("/:id/messages", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, text, sent_at FROM key_messages WHERE key_id = $1 ORDER BY sent_at DESC",
    [req.params.id]
  );
  res.json(rows);
});

router.post("/:id/messages", async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "text_required" });
  const { rows } = await pool.query(
    "INSERT INTO key_messages (key_id, text) VALUES ($1,$2) RETURNING id, text, sent_at",
    [req.params.id, text.trim()]
  );
  res.status(201).json(rows[0]);
});

export default router;
