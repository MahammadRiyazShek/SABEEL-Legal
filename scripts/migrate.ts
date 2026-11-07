import "dotenv/config";
import { migrate, pool } from "../backend/db.js";
try {
  await migrate();
  console.log("SABEEL database schema is ready");
} finally {
  await pool.end();
}
