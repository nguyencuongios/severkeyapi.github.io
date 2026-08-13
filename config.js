import "dotenv/config";

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const PORT = Number(process.env.PORT || 4000);
export const DATABASE_URL = required("DATABASE_URL");
export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
export const ADMIN_PASSWORD_HASH = required("ADMIN_PASSWORD_HASH");
export const SERVER_HMAC_SECRET = required("SERVER_HMAC_SECRET");
export const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 8 * 3600 * 1000);
