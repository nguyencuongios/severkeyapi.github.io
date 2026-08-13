import { Router } from "express";
import { pool } from "../db.js";
import { hmac } from "../crypto.js";
import { SERVER_HMAC_SECRET } from "../config.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT device_hash, device_label, banned_at FROM banned_devices ORDER BY banned_at DESC"
  );
  res.json(rows);
});

// The raw UID is only ever used in-memory here, to compute the HMAC. It is never stored.
router.post("/ban", async (req, res) => {
  const { uid, label } = req.body || {};
  if (!uid || !uid.trim()) return res.status(400).json({ error: "uid_required" });
  const deviceHash = hmac(SERVER_HMAC_SECRET, uid.trim());
  await pool.query(
    `INSERT INTO banned_devices (device_hash, device_label) VALUES ($1,$2)
     ON CONFLICT (device_hash) DO NOTHING`,
    [deviceHash, label || null]
  );
  res.status(201).json({ device_hash: deviceHash });
});

router.delete("/:hash", async (req, res) => {
  await pool.query("DELETE FROM banned_devices WHERE device_hash = $1", [req.params.hash]);
  res.json({ ok: true });
});

export default router;
