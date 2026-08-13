import pg from "pg";
import { DATABASE_URL } from "./config.js";

export const pool = new pg.Pool({ connectionString: DATABASE_URL });

pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("Unexpected PostgreSQL client error", err);
});
