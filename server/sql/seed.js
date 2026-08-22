import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;

async function run() {
  const client = new Client({
    connectionString: 'postgresql://labia_db_cjsc_user:O588SaVRD3vuXC8UHnaORLVZcshEvt8J@dpg-da12920jo6nc73fmgjkg-a.oregon-postgres.render.com/labia_db_cjsc',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const hash = await bcrypt.hash('121416', 10);
  await client.query('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)', ['Administrador', 'wfraga@labia.co', hash, 'admin']);
  console.log('✅ USUÁRIO CRIADO COM SUCESSO!');
  await client.end();
}

run().catch(e => console.error('❌ Erro:', e.message));
