/**
 * Fills the demo database "billsy_demo" (made empty by demo-up) with the demo business
 * "Demo Traders" and one demo account per role: owner@, accountant@ and staff@demo.billsy.test,
 * password DEMO_PASSWORD. Refuses any database but billsy_demo. No email is sent.
 *
 * Usage: $env:ENV_FILE='..\.env.demo'; npm run seed:demo
 */
const { knex } = require('../src/db/knex');
const { DEMO_DATABASE } = require('./databases');
const { seedDemoBusiness } = require('./seed-businesses');
const { emptyDatabase, requireDatabase } = require('./seed-helpers');

async function main() {
  requireDatabase(DEMO_DATABASE);
  await emptyDatabase();
  const { businessName, accounts } = await seedDemoBusiness();
  console.log(`${businessName}: ${accounts.map(({ role, email }) => `${role} ${email}`).join(', ')}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => knex.destroy());
