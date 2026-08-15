import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

export async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Não autenticado." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      "SELECT id,name,email,role,active FROM users WHERE id=$1",
      [payload.sub]
    );
    if (!rows[0]?.active) return res.status(401).json({ error: "Usuário inativo." });
    req.user = rows[0];
    next();
  } catch {
    res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : res.status(403).json({ error: "Permissão insuficiente." });
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
