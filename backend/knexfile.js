// Knex settings, used by the app (src/db/knex.js) and by the knex CLI (npm run migrate).
// The values were tried in the Node + MySQL spike (BACKEND.md, "Data layer").
const path = require('node:path');
const { env } = require('./src/config/env');

function connectionSettings(database) {
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database,
    charset: 'utf8mb4',
    // Read and write DATETIME values as UTC, whatever the machine's time zone is.
    timezone: 'Z',
    // DECIMAL columns come back as strings ("1234.50"), never as JS numbers, so no float ever
    // touches money. decimal.js does the arithmetic.
    decimalNumbers: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
    // A DATE (invoice date) comes back as the plain string "2027-03-31". As a JS Date it would be
    // midnight in some zone and could print as the day before.
    dateStrings: ['DATE'],
    // A hosted MySQL (Aiven) accepts only TLS: DB_SSL_CA is its CA certificate (PEM), and the
    // server's certificate is then checked against it. Local MySQL needs neither.
    ...(env.DB_SSL_CA ? { ssl: { ca: env.DB_SSL_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true } } : {}),
  };
}

module.exports = {
  client: 'mysql2',
  connection: connectionSettings(env.DB_NAME),
  pool: {
    min: 0,
    max: 10,
    // mysql2's `timezone: 'Z'` only converts JS Dates. The server session still runs in the
    // machine's zone (@@time_zone = SYSTEM, IST here), so NOW() and DEFAULT CURRENT_TIMESTAMP
    // would store Indian time. Every new pooled connection is switched to UTC first.
    afterCreate(connection, done) {
      connection.query("SET time_zone = '+00:00'", (error) => done(error, connection));
    },
  },
  migrations: { directory: path.resolve(__dirname, 'migrations'), tableName: 'knex_migrations' },

  connectionSettings,
};
