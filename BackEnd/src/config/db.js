const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Carrega as variáveis do arquivo .env

// Configura a conexão usando as variáveis do .env
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // Necessário para conectar em bancos gerenciados (ex: Render) via rede externa.
  // Em Postgres local (docker-compose) isso é ignorado sem problema.
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

// Testa a conexão para avisar no terminal se deu certo e garante que as
// tabelas existam (roda o init.sql, que usa IF NOT EXISTS / ON CONFLICT
// DO NOTHING, então é seguro executar toda vez que o servidor sobe).
async function iniciar() {
  try {
    const client = await pool.connect();
    console.log('🚀 Conexão com o PostgreSQL estabelecida com sucesso!');
    client.release();

    const initSqlPath = path.join(__dirname, '..', '..', 'db', 'init.sql');
    const sql = fs.readFileSync(initSqlPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Tabelas verificadas/criadas com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao conectar/preparar o PostgreSQL:', err.stack);
  }
}

iniciar();

module.exports = {
  query: (text, params) => pool.query(text, params),
};
