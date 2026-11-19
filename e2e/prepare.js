/**
 * Gets billsy_test ready for a Playwright run, using the backend's own scripts:
 *   1. make-env.js test  -> Billsy/.env.test (billsy_test, new JWT secret, new Ethereal inboxes,
 *                            new E2E_PASSWORD, rate limits off, X-Test-Now on)
 *   2. db-create.js      -> creates billsy_test if it is missing
 *   3. knex migrate      -> the current schema
 *   4. seed-test.js      -> empties billsy_test, then the pool of test businesses + the demo business
 * and clears the slot locks (helpers/pool.js) of the last run.
 *
 * Usage: npm test (runs this, then playwright test), or node prepare.js on its own.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const backend = path.resolve(__dirname, '../backend');
const envFile = path.resolve(__dirname, '../.env.test');

function run(args, { withTestEnv = true } = {}) {
  const env = { ...process.env, ...(withTestEnv ? { ENV_FILE: envFile } : {}) };
  execFileSync(process.execPath, args, { cwd: backend, env, stdio: 'inherit' });
}

run(['scripts/make-env.js', 'test', ...process.argv.slice(2)], { withTestEnv: false });
run(['scripts/db-create.js']);
run([require.resolve('knex/bin/cli.js', { paths: [backend] }), 'migrate:latest']);
run(['scripts/seed-test.js']);

fs.rmSync(path.join(__dirname, '.slots'), { recursive: true, force: true });
console.log('Ready: run "npx playwright test".');
