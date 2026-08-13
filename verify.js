import { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool } from "../db.js";
import { hmac } from "../crypto.js";
import { SERVER_HMAC_SECRET } from "../config.js";

const router = Router();

const verifyLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" },
});

// Public endpoint called by the end-user's app. Checks expiry, revoke status,
// device binding, and remaining uses. Never returns key material or secrets.
router.post("/", verifyLimiter, async (req, res) => {
  const { key, device_uid } = req.body || {};
  if (!key) return res.status(400).json({ error: "key_required" });

  const keyHash = hmac(SERVER_HMAC_SECRET, key);
  const { rows } = await pool.query(
    `SELECT k.*, p.status AS package_status, p.name AS package_name, p.version,
            p.contact_link, p.update_link, p.notify_message, p.allow_free_login
     FROM api_keys k
     JOIN packages p ON p.id = k.package_id
     WHERE k.key_hash = $1`,
    [keyHash]
  );
  const row = rows[0];
  if (!row) return res.status(403).json({ error: "invalid_key" });
  if (row.revoked) return res.status(403).json({ error: "key_revoked" });
  if (new Date(row.expires_at) < new Date()) return res.status(403).json({ error: "key_expired" });
  if (row.package_status === "maintenance") return res.status(423).json({ error: "package_maintenance" });

  let deviceHash = null;
  if (device_uid) {
    deviceHash = hmac(SERVER_HMAC_SECRET, device_uid);

    const banned = await pool.query("SELECT 1 FROM banned_devices WHERE device_hash = $1", [deviceHash]);
    if (banned.rows.length) return res.status(403).json({ error: "device_banned" });

    if (row.device_hash && row.device_hash !== deviceHash) {
      return res.status(403).json({ error: "device_mismatch" });
    }
  } else if (!row.allow_free_login) {
    return res.status(400).json({ error: "device_uid_required" });
  }

  if (row.used_count >= row.max_uses) return res.status(403).json({ error: "usage_limit_reached" });

  await pool.query(
    "UPDATE api_keys SET used_count = used_count + 1, device_hash = COALESCE(device_hash, $2) WHERE id = $1",
    [row.id, deviceHash]
  );

  res.json({
    ok: true,
    package: {
      name: row.package_name,
      version: row.version,
      contact_link: row.contact_link,
      update_link: row.update_link,
      notify_message: row.notify_message,
    },
    remaining_uses: Math.max(row.max_uses - row.used_count - 1, 0),
  });
});

export default router;
