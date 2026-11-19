const { createApp } = require('./app');
const { env } = require('./config/env');
const { knex } = require('./db/knex');
const { logger } = require('./utils/logger');

// Billsy has no scheduled jobs: "Overdue" and "Part paid" are worked out when an invoice is read.

async function main() {
  // Fail fast if MySQL is down or the schema is missing (run `npm run migrate` first).
  await knex.raw('SELECT 1 FROM knex_migrations LIMIT 1');

  const app = createApp();
  const server = app.listen(env.PORT, (error) => {
    if (error) {
      logger.fatal({ err: error }, 'Could not start the HTTP server');
      process.exit(1);
    }
    logger.info({ port: env.PORT, database: env.DB_NAME }, 'Billsy API listening');
  });

  const shutdown = (signal) => {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      await knex.destroy();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.fatal({ err: { type: error?.name, code: error?.code, message: error?.message } }, 'Billsy API failed to start');
  process.exit(1);
});
