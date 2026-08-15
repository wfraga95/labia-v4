import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: String(process.env.DATABASE_URL || ""),
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  try {
    // 1. Garante a extensão para UUID se necessário
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // 2. Garante a coluna role na tabela users
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
    `);

    // 3. Cria tabela de convites usando UUID para created_by e used_by
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invite_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        created_by UUID REFERENCES users(id),
        used_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Banco de dados inicializado com sucesso!");
  } catch (error) {
    console.error("Erro ao inicializar o banco de dados:", error);
  }
}