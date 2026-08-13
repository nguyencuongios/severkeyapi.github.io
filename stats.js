import { Router } from "express";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  const [pkgCount, keyCount, revokedCount, bannedDevCount, usage] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS c FROM packages"),
    pool.query("SELECT COUNT(*)::int AS c FROM api_keys"),
    pool.query("SELECT COUNT(*)::int AS c FROM api_keys WHERE revoked = true"),
    pool.query("SELECT COUNT(*)::int AS c FROM banned_devices"),
    pool.query(`
      SELECT p.id, p.name,
             COALESCE(SUM(k.used_count), 0)::int AS used,
             COALESCE(SUM(GREATEST(k.max_uses - k.used_count, 0)), 0)::int AS remaining
      FROM packages p
      LEFT JOIN api_keys k ON k.package_id = p.id
      GROUP BY p.id, p.name
      ORDER BY p.name
    `),
  ]);

  res.json({
    totalPackages: pkgCount.rows[0].c,
    totalKeys: keyCount.rows[0].c,
    revokedKeys: revokedCount.rows[0].c,
    bannedDevices: bannedDevCount.rows[0].c,
    usageByPackage: usage.rows,
  });
});

export default router;
