/**
 * Empties the development database "billsy" and fills it again with:
 * - Kaveri Studio (Owner dev@billsy.test, Accountant meera@kaveri.billsy.test, Staff ravi@kaveri.billsy.test)
 * - Demo Traders with the three demo accounts (owner@, accountant@, staff@demo.billsy.test),
 *   used by the /demo page when DEMO_MODE=true.
 * Every account's password is DEMO_PASSWORD. Refuses any database but billsy.
 * No email is sent.
 *
 * Usage: npm run seed:dev
 */
const { knex } = require('../src/db/knex');
const { DEV_DATABASE } = require('./databases');
const { seedDemoBusiness, seedDevBusiness } = require('./seed-businesses');
const { emptyDatabase, requireDatabase } = require('./seed-helpers');

async function main() {
  requireDatabase(DEV_DATABASE);
  await emptyDatabase();
  const results = [await seedDevBusiness(), await seedDemoBusiness()];

  for (const { businessName, accounts } of results) {
    console.log(`${businessName}:`);
    for (const { role, email } of accounts) {
      console.log(`  ${role.padEnd(11)} ${email}`);
    }
  }
  console.log('Password for every account: DEMO_PASSWORD in backend/.env');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => knex.destroy());
