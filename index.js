import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { PORT, FRONTEND_ORIGIN } from "./config.js";

import adminAuthRoutes from "./routes/adminAuth.js";
import packageRoutes from "./routes/packages.js";
import keyRoutes from "./routes/keys.js";
import deviceRoutes from "./routes/devices.js";
import statsRoutes from "./routes/stats.js";
import verifyRoutes from "./routes/verify.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: "100kb" }));

// Baseline rate limit for all routes; login and verify have their own tighter limits.
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/healthz", (req, res) => res.json({ ok: true }));

app.use("/v1/admin", adminAuthRoutes); // /v1/admin/login, /v1/admin/logout
app.use("/v1/admin/packages", packageRoutes);
app.use("/v1/admin/keys", keyRoutes);
app.use("/v1/admin/devices", deviceRoutes);
app.use("/v1/admin/stats", statsRoutes);
app.use("/v1/verify", verifyRoutes);

app.use((req, res) => res.status(404).json({ error: "not_found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(PORT, () => {
  console.log(`Key server API listening on port ${PORT}`);
});
