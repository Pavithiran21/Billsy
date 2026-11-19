const knexFactory = require('knex');
const config = require('../../knexfile');

// One shared Knex instance (one connection pool) for the whole app.
const knex = knexFactory(config);

/** True when MySQL answers a trivial query (used by /api/health). */
async function isDbUp() {
  try {
    await knex.raw('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

module.exports = { knex, isDbUp };
