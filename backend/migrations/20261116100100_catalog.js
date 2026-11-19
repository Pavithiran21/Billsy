// Customers and products of a business. Every query filters by business_id (no IDOR), so each
// table's indexes start with it.

const MONEY = [14, 2]; // up to 999,999,999,999.99 rupees, exact

exports.up = async function up(knex) {
  await knex.schema.createTable('customers', (t) => {
    t.increments('id');
    t.integer('business_id').unsigned().notNullable().references('id').inTable('businesses');
    t.string('name', 160).notNullable();
    // Optional (a consumer has none); when present its first two digits must match state_code.
    t.specificType('gstin', 'CHAR(15)').nullable();
    // Required: the customer's state is the place of supply, which decides CGST + SGST or IGST.
    t.specificType('state_code', 'CHAR(2)').notNullable();
    t.string('email', 254).nullable();
    t.string('address', 500).nullable();
    t.integer('version').unsigned().notNullable().defaultTo(1);
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.datetime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.index(['business_id', 'name'], 'ix_customers_business_name');
  });

  await knex.schema.createTable('products', (t) => {
    t.increments('id');
    t.integer('business_id').unsigned().notNullable().references('id').inTable('businesses');
    t.string('name', 160).notNullable();
    t.string('hsn_sac', 8).notNullable();
    t.decimal('price', ...MONEY).notNullable();
    t.decimal('gst_rate', 5, 2).notNullable(); // 0, 0.25, 3, 5, 12, 18, 28, 40
    t.integer('version').unsigned().notNullable().defaultTo(1);
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.datetime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.index(['business_id', 'name'], 'ix_products_business_name');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('products');
  await knex.schema.dropTable('customers');
};
