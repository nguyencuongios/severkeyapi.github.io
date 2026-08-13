import crypto from "crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

/** Hash a password with scrypt. Stored format: scrypt$N$r$p$saltHex$hashHex */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Verify a password against a stored scrypt hash using a constant-time comparison. */
export function verifyPassword(password, stored) {
  try {
    const [alg, nStr, rStr, pStr, saltHex, hashHex] = stored.split("$");
    if (alg !== "scrypt") return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** HMAC-SHA256 a value with the server secret. Used for key hashes, device hashes, session token hashes. */
export function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

/** Generate a plaintext API key. Only ever returned to the caller once, at creation time. */
export function generateApiKey() {
  return `sk_${crypto.randomBytes(32).toString("hex")}`;
}

/** Generate an opaque admin session token (plaintext, returned once at login). */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

/** Generate a public, non-secret package identifier. */
export function generateApiId() {
  return `pkg_${crypto.randomBytes(6).toString("hex")}`;
}
