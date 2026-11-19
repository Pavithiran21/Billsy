/**
 * Drops billsy_test or billsy_demo and confirms it is gone. Any other name is refused, so this
 * script can never drop the development database (MySQL logs in as root, which could).
 * The server and login come from backend/.env (or ENV_FILE); the name comes from the argument.
 *
 * Usage: npm run db:drop -- billsy_demo
 */
const mysql = require('mysql2/promise');
const { env } = require('../src/config/env');
const { DROPPABLE_DATABASES } = require('./databases');

async function main() {
  const name = process.argv[2];
  if (!DROPPABLE_DATABASES.includes(name)) {
    throw new Error(`db-drop only drops ${DROPPABLE_DATABASES.join(' or ')}, not "${name ?? ''}".`);
  }

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  });
  try {
    // The name is from the allow-list above, so putting it in the statement is safe.
    await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
    const [rows] = await connection.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [name]);
    if (rows.length > 0) {
      throw new Error(`${name} still exists after the drop.`);
    }
    console.log(`Dropped ${name}; confirmed it no longer exists.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
