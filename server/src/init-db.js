import fs from "node:fs";
import { pool } from "./db.js";
const sql = fs.readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8");
await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
await pool.query(sql);
console.log("Banco inicializado.");
await pool.end();
