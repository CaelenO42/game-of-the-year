import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./pool.js";

const schemaPath = path.join(import.meta.dirname, "../../", "db", "schema.sql");

try {
  const sql = await readFile(schemaPath, "utf8");

  await pool.query(sql);

  console.log("Schema applied");
} finally {
  await pool.end();
}
