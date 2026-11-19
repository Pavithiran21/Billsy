/**
 * Seeds billsy_test for a Playwright run (any other database is refused):
 *
 * 1. A pool of SLOT_COUNT test businesses ("slots"). Each slot is a Karnataka business with an
 *    Owner, an Accountant and two Staff members, all with the password E2E_PASSWORD. Every test
 *    takes its own slot (e2e/helpers/pool.js), so its invoice numbers start at 0001 and nothing
 *    leaks between parallel tests. The rows are batch-inserted with one bcrypt hash: 12,000 users
 *    take a few seconds instead of 12,000 hashes. They are plain accounts and memberships, the same
 *    rows an accepted invitation writes (no email is sent).
 * 2. The demo business "Demo Traders" with the three demo accounts (password DEMO_PASSWORD),
 *    through the same function as seed:demo, for the "Log in as" and demo-lock tests.
 *
 * Usage (e2e.ps1 runs it): $env:ENV_FILE='..\.env.test'; npm run seed:test
 */
const bcrypt = require('bcryptjs');
const { knex } = require('../src/db/knex');
const { BCRYPT_ROUNDS } = require('../src/modules/auth/auth.service');
const { TEST_DATABASE } = require('./databases');
const { seedDemoBusiness } = require('./seed-businesses');
const { emptyDatabase, requireDatabase } = require('./seed-helpers');

const SLOT_COUNT = 3000;
const POOL_DOMAIN = 'e2e.billsy.test';
const CHUNK = 500;

// The four people of every slot. The e2e helpers build the same addresses (helpers/pool.js).
const MEMBERS = [
  { key: 'owner', role: 'owner', label: 'Owner' },
  { key: 'accountant', role: 'accountant', label: 'Accountant' },
  { key: 'staff', role: 'staff', label: 'Staff' },
  { key: 'staff2', role: 'staff', label: 'Staff Two' },
];

const pad = (slot) => String(slot).padStart(4, '0');

/** 29 + P + four letters from the slot number + 0000X1Z5: unique per slot and in GSTIN format. */
function poolGstin(slot) {
  let letters = '';
  let rest = slot;
  for (let i = 0; i < 4; i += 1) {
    letters = String.fromCharCode(65 + (rest % 26)) + letters;
    rest = Math.floor(rest / 26);
  }
  return `29P${letters}0000X1Z5`;
}

async function insertInChunks(table, rows) {
  for (let start = 0; start < rows.length; start += CHUNK) {
    await knex(table).insert(rows.slice(start, start + CHUNK));
  }
}

async function seedPool(password) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const slots = Array.from({ length: SLOT_COUNT }, (_, index) => index + 1);

  await insertInChunks(
    'businesses',
    slots.map((slot) => ({
      legal_name: `Pool Traders ${pad(slot)}`,
      gstin: poolGstin(slot),
      address: `${slot} MG Road, Bengaluru 560001`,
      state_code: '29',
    })),
  );
  await insertInChunks(
    'users',
    slots.flatMap((slot) =>
      MEMBERS.map((member) => ({
        name: `${member.label} ${pad(slot)}`,
        email: `${member.key}.s${slot}@${POOL_DOMAIN}`,
        password_hash: passwordHash,
      })),
    ),
  );

  // Look the new ids up by their unique columns (MySQL returns only the first id of a batch).
  const businessIdBySlot = new Map();
  for (const row of await knex('businesses').select('id', 'legal_name').where('legal_name', 'like', 'Pool Traders %')) {
    businessIdBySlot.set(Number(row.legal_name.slice('Pool Traders '.length)), row.id);
  }
  const userIdByEmail = new Map();
  for (const row of await knex('users').select('id', 'email').where('email', 'like', `%@${POOL_DOMAIN}`)) {
    userIdByEmail.set(row.email, row.id);
  }

  await insertInChunks(
    'memberships',
    slots.flatMap((slot) =>
      MEMBERS.map((member) => ({
        user_id: userIdByEmail.get(`${member.key}.s${slot}@${POOL_DOMAIN}`),
        business_id: businessIdBySlot.get(slot),
        role: member.role,
      })),
    ),
  );
}

async function main() {
  requireDatabase(TEST_DATABASE);
  const password = process.env.E2E_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Set E2E_PASSWORD (at least 8 characters) in the test env file; make-env.js writes it.');
  }

  await emptyDatabase();
  await seedPool(password);
  const { businessName } = await seedDemoBusiness();
  console.log(`billsy_test: ${SLOT_COUNT} pool businesses (${SLOT_COUNT * MEMBERS.length} people) and ${businessName}.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => knex.destroy());
