// Usage: npm run hash-password -- "your-strong-password"
import { hashPassword } from "../src/crypto.js";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.js <password>");
  process.exit(1);
}

console.log(hashPassword(password));
console.log("\nPaste the line above into ADMIN_PASSWORD_HASH in your .env file.");
