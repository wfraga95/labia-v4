import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const passwordHash = await bcrypt.hash("121416", 12);
await pool.query(
  `INSERT INTO users (name,email,password_hash,role)
   VALUES ($1,$2,$3,'admin')
   ON CONFLICT (email) DO NOTHING`,
  ["Administrador LabIA", "admin@labia.com", passwordHash]
);
console.log("Usuário admin criado/verificado.");
await pool.end();
