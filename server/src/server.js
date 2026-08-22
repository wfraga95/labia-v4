import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { pool, initDb } from "./db.js";
import { auth, requireRole, signToken, verifyPassword } from "./auth.js";
import { askAI, readOrder } from "./ai.js";
import bcrypt from "bcryptjs";

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

app.get("/health", (_req, res) => res.json({ ok: true, version: "4.0.0" }));

// ROTA DE REGISTRO DE USUÁRIO (Requer Código de Convite)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, inviteCode } = req.body;

    if (!name || !email || !password || !inviteCode) {
      return res.status(400).json({ error: "Todos os campos e o código de convite são obrigatórios." });
    }

    // 1. Valida se o código de convite existe e não foi usado
    const codeResult = await pool.query(
      "SELECT * FROM invite_codes WHERE code = $1 AND is_used = false",
      [inviteCode]
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ error: "Código de convite inválido ou já utilizado." });
    }

    // 2. Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Insere o novo usuário
    const userResult = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, active) VALUES ($1, $2, $3, 'user', true) RETURNING id, name, email, role",
      [name, email, hashedPassword]
    );

    const newUser = userResult.rows[0];

    // 4. Marca o código como utilizado
    await pool.query(
      "UPDATE invite_codes SET is_used = true, used_by = $1 WHERE id = $2",
      [newUser.id, codeResult.rows[0].id]
    );

    res.json({ message: "Conta criada com sucesso!", user: newUser });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ROTA PARA O PRIMEIRO ADM SE CADASTRAR (Chave Mestra)
app.post("/api/auth/register-admin", async (req, res) => {
  try {
    const { name, email, password, adminSecret } = req.body;
    
    if (adminSecret !== "CHAVE_MESTRA_LABIA") {
      return res.status(403).json({ error: "Chave mestra incorreta." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, active) VALUES ($1, $2, $3, 'admin', true) RETURNING id, name, email, role",
      [name, email, hashedPassword]
    );

    res.json({ message: "Administrador criado com sucesso!", user: rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ROTA EXCLUSIVA ADM: Listar todos os usuários/laboratórios
app.get("/api/admin/users", auth, requireRole("admin"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, role, active, created_at FROM users ORDER BY created_at DESC"
    );
    res.json({ users: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ROTA EXCLUSIVA ADM: Activar / Bloquear usuário
app.patch("/api/admin/users/:id/toggle-status", auth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Busca status atual do usuário
    const userResult = await pool.query("SELECT id, active FROM users WHERE id = $1", [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const currentActiveStatus = userResult.rows[0].active;
    const newStatus = !currentActiveStatus;

    // Atualiza para o status oposto
    const { rows } = await pool.query(
      "UPDATE users SET active = $1 WHERE id = $2 RETURNING id, name, email, role, active",
      [newStatus, id]
    );

    // Registra no log de auditoria
    await pool.query(
      "INSERT INTO audit_logs(user_id, action, resource, resource_id) VALUES($1, $2, $3, $4)",
      [req.user.id, newStatus ? "user_activated" : "user_deactivated", "user", id]
    );

    res.json({ message: `Usuário ${newStatus ? 'ativado' : 'bloqueado'} com sucesso!`, user: rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ROTA EXCLUSIVA ADM: Gerar código de convite
app.post("/api/admin/invite-codes", auth, requireRole("admin"), async (req, res) => {
  try {
    const newCode = "LAB-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const { rows } = await pool.query(
      "INSERT INTO invite_codes (code, created_by) VALUES ($1, $2) RETURNING *",
      [newCode, req.user.id]
    );
    res.json({ inviteCode: rows[0].code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ROTA EXCLUSIVA ADM: Listar todos os convites criados
app.get("/api/admin/invite-codes", auth, requireRole("admin"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT i.*, u.email as used_by_email FROM invite_codes i LEFT JOIN users u ON i.used_by = u.id ORDER BY i.created_at DESC"
    );
    res.json({ inviteCodes: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE email=$1 AND active=true", [email]
    );
    if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash)))
      return res.status(401).json({ error: "E-mail ou senha inválidos ou conta inativa." });
    const user = { id: rows[0].id, name: rows[0].name, email: rows[0].email, role: rows[0].role };
    await pool.query(
      "INSERT INTO audit_logs(user_id,action,resource) VALUES($1,$2,$3)",
      [user.id, "login", "auth"]
    );
    res.json({ token: signToken(user), user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/me", auth, (req, res) => res.json({ user: req.user }));

app.post("/api/chat", auth, async (req, res) => {
  try {
    const { message, conversationId, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: "Mensagem obrigatória." });

    const input = [
      ...history.slice(-12).map(m => ({ role: m.role, content: m.content || m.text })),
      { role: "user", content: message }
    ];
    const text = await askAI(input);

    let cid = conversationId;
    if (!cid) {
      const r = await pool.query(
        "INSERT INTO conversations(user_id,title) VALUES($1,$2) RETURNING id",
        [req.user.id, message.slice(0, 80)]
      );
      cid = r.rows[0].id;
    }
    await pool.query(
      "INSERT INTO messages(conversation_id,role,content) VALUES($1,'user',$2),($1,'assistant',$3)",
      [cid, message, text]
    );
    await pool.query(
      "INSERT INTO audit_logs(user_id,action,resource,resource_id) VALUES($1,$2,$3,$4)",
      [req.user.id, "ai_chat", "conversation", cid]
    );
    res.json({ text, conversationId: cid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/analyze-order", auth, async (req, res) => {
  try {
    const { base64, mimeType = "image/jpeg" } = req.body;
    if (!base64) return res.status(400).json({ error: "Imagem obrigatória." });
    const text = await readOrder(base64, mimeType);
    await pool.query(
      "INSERT INTO audit_logs(user_id,action,resource,metadata) VALUES($1,$2,$3,$4)",
      [req.user.id, "analyze_order", "medical_order", JSON.stringify({ mimeType })]
    );
    res.json({ text });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/exams", auth, async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT DISTINCT exam_name, laboratory, method FROM exam_reference_ranges ORDER BY exam_name"
  );
  res.json({ exams: rows });
});

app.get("/api/conversations", auth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id,title,created_at,updated_at FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC",
    [req.user.id]
  );
  res.json({ conversations: rows });
});

app.get("/api/admin/documents", auth, requireRole("admin", "professor"), async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id,title,source,category,version,status,created_at FROM knowledge_documents ORDER BY created_at DESC"
  );
  res.json({ documents: rows });
});

app.post("/api/admin/documents", auth, requireRole("admin", "professor"), async (req, res) => {
  const { title, source, category, version, storageKey } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO knowledge_documents(title,source,category,version,storage_key,uploaded_by)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [title, source, category, version, storageKey, req.user.id]
  );
  res.json({ document: rows[0] });
});

app.get("/api/admin/audit", auth, requireRole("admin"), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*,u.email FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id
     ORDER BY a.created_at DESC LIMIT 500`
  );
  res.json({ logs: rows });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, async () => {
  await initDb();
  console.log(`LabIA V4 API na porta ${PORT}`);
});