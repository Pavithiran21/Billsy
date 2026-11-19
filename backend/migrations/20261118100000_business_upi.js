// The business's UPI ID (VPA), optional. When it is set, an issued invoice with money still due
// prints a "Scan to pay" UPI QR for the amount due on its PDF.

exports.up = async function up(knex) {
  await knex.schema.alterTable('businesses', (t) => {
    t.string('upi_id', 100).nullable().after('state_code');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('businesses', (t) => {
    t.dropColumn('upi_id');
  });
};
