/**
 * Creates the database named by DB_NAME in backend/.env (or ENV_FILE) if it doesn't exist yet,
 * with utf8mb4. Only billsy, billsy_test and billsy_demo are accepted. Never drops anything.
 *
 * Usage: npm run db:create
 */
const mysql = require('mysql2/promise');
const { env } = require('../src/config/env');
const { CREATABLE_DATABASES } = require('./databases');

async function main() {
  const name = env.DB_NAME;
  if (!CREATABLE_DATABASES.includes(name)) {
    throw new Error(`db-create only creates ${CREATABLE_DATABASES.join(', ')}, not "${name}".`);
  }

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  });
  try {
    // The name is from the allow-list above, so putting it in the statement is safe.
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    console.log(`Database ${name} is ready.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
