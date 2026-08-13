import { Router } from "express";
import { pool } from "../db.js";
import { generateApiId } from "../crypto.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAdmin);

const EDITABLE_FIELDS = [
  "name", "description", "key_name", "version", "status",
  "allow_free_login", "get_real_uid_ios", "contact_link", "update_link", "notify_message",
];

router.get("/", async (req, res) => {
  const { rows } = await pool.query(`
    SELECT p.*, COUNT(k.id)::int AS key_count
    FROM packages p
    LEFT JOIN api_keys k ON k.package_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.name.trim()) return res.status(400).json({ error: "name_required" });

  const apiId = generateApiId();
  const { rows } = await pool.query(
    `INSERT INTO packages
       (api_id, name, description, key_name, version, status, allow_free_login, get_real_uid_ios, contact_link, update_link, notify_message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      apiId,
      body.name.trim(),
      body.description || "",
      body.key_name || "",
      body.version || "1.0.0",
      body.status === "maintenance" ? "maintenance" : "active",
      !!body.allow_free_login,
      !!body.get_real_uid_ios,
      body.contact_link || "",
      body.update_link || "",
      body.notify_message || "",
    ]
  );
  res.status(201).json({ ...rows[0], key_count: 0 });
});

router.put("/:id", async (req, res) => {
  const body = req.body || {};
  const values = [];
  const sets = [];
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) {
      values.push(body[field]);
      sets.push(`${field} = $${values.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: "no_fields" });
  values.push(req.params.id);

  const { rows } = await pool.query(
    `UPDATE packages SET ${sets.join(", ")}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: "not_found" });
  res.json(rows[0]);
});

router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM packages WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

router.post("/:id/reset-keys", async (req, res) => {
  await pool.query(
    "UPDATE api_keys SET used_count = 0, device_hash = NULL, revoked = false WHERE package_id = $1",
    [req.params.id]
  );
  res.json({ ok: true });
});

router.delete("/:id/keys", async (req, res) => {
  await pool.query("DELETE FROM api_keys WHERE package_id = $1", [req.params.id]);
  res.json({ ok: true });
});

export default router;
