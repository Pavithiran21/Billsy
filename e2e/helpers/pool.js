const fs = require('node:fs');
const path = require('node:path');

// seed-test.js makes SLOT_COUNT pool businesses, "Pool Traders 0001" and up, each with an Owner,
// an Accountant and two Staff (all with E2E_PASSWORD). A test that writes data claims a slot of its
// own, so its invoice numbers start at 0001 and nothing it does is seen by another test.
//
// A slot is claimed by creating e2e/.slots/<n> with the "wx" flag, which fails if the file exists:
// atomic across Playwright's worker processes. prepare.js clears the folder before every run.

const SLOT_COUNT = 3000;
const POOL_DOMAIN = 'e2e.billsy.test';
const slotsDir = path.join(__dirname, '..', '.slots');

function claimSlot() {
  fs.mkdirSync(slotsDir, { recursive: true });
  for (let slot = 1; slot <= SLOT_COUNT; slot += 1) {
    try {
      fs.closeSync(fs.openSync(path.join(slotsDir, String(slot)), 'wx'));
      return slotPeople(slot);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('Every test slot is taken; run prepare.js again.');
}

/** The people of a slot, as seed-test.js names them. */
function slotPeople(slot) {
  const email = (key) => `${key}.s${slot}@${POOL_DOMAIN}`;
  return {
    slot,
    businessName: `Pool Traders ${String(slot).padStart(4, '0')}`,
    owner: email('owner'),
    accountant: email('accountant'),
    staff: email('staff'),
    staff2: email('staff2'),
  };
}

function poolPassword() {
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error('E2E_PASSWORD is missing; run prepare.js first.');
  return password;
}

module.exports = { claimSlot, poolPassword };
