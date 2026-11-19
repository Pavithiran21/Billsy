/**
 * Writes a git-ignored env file for a Playwright run or a demo, copied from backend/.env with:
 *   - DB_NAME = billsy_test or billsy_demo (same local MySQL server and root login)
 *   - a new random JWT_SECRET, so every token from an earlier run or demo is rejected (401)
 *   - two brand-new Ethereal inboxes (SMTP_* and DEMO_SMTP_*), so the run's mail starts empty
 *     and nothing is ever sent through Brevo
 *
 * The test file also gets E2E_PASSWORD (the password of the seeded test pool, new every run),
 * TIME_OVERRIDE_ENABLED=true (tests pin "now" with X-Test-Now) and the rate limiters off, unless
 * "--rate-limits on" is given.
 *
 * Usage: node scripts/make-env.js test [--rate-limits on]    -> Billsy/.env.test
 *        node scripts/make-env.js demo                       -> Billsy/.env.demo
 */
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DEMO_DATABASE, TEST_DATABASE } = require('./databases');
const { setEnvValue, writeNewEtherealAccount } = require('./new-ethereal');

const projectRoot = path.resolve(__dirname, '../..');

const TARGETS = {
  test: {
    fileName: '.env.test',
    values: { DB_NAME: TEST_DATABASE, NODE_ENV: 'test', LOG_LEVEL: 'info', TIME_OVERRIDE_ENABLED: 'true', DEMO_MODE: 'true' },
  },
  demo: {
    fileName: '.env.demo',
    values: {
      DB_NAME: DEMO_DATABASE,
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      TIME_OVERRIDE_ENABLED: 'false',
      DEMO_MODE: 'true',
      RATE_LIMITS_ENABLED: 'true',
    },
  },
};

async function main() {
  const targetName = process.argv[2];
  const target = TARGETS[targetName];
  if (!target) {
    throw new Error(`Usage: node scripts/make-env.js <${Object.keys(TARGETS).join('|')}> [--rate-limits on]`);
  }

  const sourceFile = path.join(projectRoot, 'backend', '.env');
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`No .env at ${sourceFile}. See README.md.`);
  }

  let text = fs.readFileSync(sourceFile, 'utf8');
  text = setEnvValue(text, 'JWT_SECRET', randomBytes(48).toString('base64url'));
  for (const [key, value] of Object.entries(target.values)) {
    text = setEnvValue(text, key, value);
  }
  if (targetName === 'test') {
    const rateLimitsOn = process.argv.includes('--rate-limits') && process.argv.includes('on');
    text = setEnvValue(text, 'RATE_LIMITS_ENABLED', rateLimitsOn ? 'true' : 'false');
    // The password of the seeded test pool (seed-test.js); new for every run.
    text = setEnvValue(text, 'E2E_PASSWORD', `E2e-${randomBytes(12).toString('base64url')}-1`);
  }

  const targetFile = path.join(projectRoot, target.fileName);
  fs.writeFileSync(targetFile, text);
  const mainInbox = await writeNewEtherealAccount(targetFile, 'SMTP');
  const testAddressInbox = await writeNewEtherealAccount(targetFile, 'DEMO_SMTP');

  console.log(
    `Wrote ${target.fileName}: database ${target.values.DB_NAME}, new login secret, ` +
      `new Ethereal inboxes ${mainInbox} (SMTP_*) and ${testAddressInbox} (DEMO_SMTP_*).`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
