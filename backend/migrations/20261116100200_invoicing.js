// Invoices, their lines, credit notes, payments, the numbering sequences and the audit log.
// The numbering design is in BACKEND.md ("Gap-free numbering").

const MONEY = [14, 2]; // up to 999,999,999,999.99 rupees, exact
const QUANTITY = [12, 3]; // 1.250 kg

function totals(t) {
  t.decimal('taxable_total', ...MONEY).notNullable().defaultTo('0.00');
  t.decimal('cgst_total', ...MONEY).notNullable().defaultTo('0.00');
  t.decimal('sgst_total', ...MONEY).notNullable().defaultTo('0.00');
  t.decimal('igst_total', ...MONEY).notNullable().defaultTo('0.00');
  t.decimal('grand_total', ...MONEY).notNullable().defaultTo('0.00');
}

function lineAmounts(t) {
  t.decimal('taxable', ...MONEY).notNullable();
  t.decimal('cgst', ...MONEY).notNullable();
  t.decimal('sgst', ...MONEY).notNullable();
  t.decimal('igst', ...MONEY).notNullable();
  t.decimal('line_total', ...MONEY).notNullable();
}

exports.up = async function up(knex) {
  // One row per business, document type and financial year. The row is the lock that makes
  // numbering gap-free: a transaction locks it, takes next_value, and adds one.
  await knex.schema.createTable('number_sequences', (t) => {
    t.integer('business_id').unsigned().notNullable().references('id').inTable('businesses');
    t.enu('doc_type', ['INV', 'CN']).notNullable();
    t.specificType('fy', 'CHAR(7)').notNullable(); // "2026-27"
    t.integer('next_value').unsigned().notNullable();
    // Date of the last document numbered from this row. Kept here so the "no earlier date than
    // the last issued one" rule is read under the same row lock as the number.
    t.date('last_issued_date').nullable();
    t.primary(['business_id', 'doc_type', 'fy']);
  });

  await knex.schema.createTable('invoices', (t) => {
    t.increments('id');
    t.integer('business_id').unsigned().notNullable().references('id').inTable('businesses');
    // RESTRICT: a customer can't be deleted while any invoice uses it.
    t.integer('customer_id').unsigned().notNullable().references('id').inTable('customers');
    // The stored lifecycle. "Part paid" and "Overdue" are worked out when read.
    t.enu('status', ['draft', 'issued', 'paid', 'cancelled']).notNullable().defaultTo('draft');
    // Number and financial year stay NULL while the invoice is a draft.
    t.integer('number').unsigned().nullable();
    t.specificType('fy', 'CHAR(7)').nullable();
    t.date('invoice_date').notNullable();
    t.date('due_date').notNullable();
    // The customer's state; the same as seller_state_code means CGST + SGST, otherwise IGST.
    t.specificType('place_of_supply', 'CHAR(2)').notNullable();
    // Seller and customer details as they were when the invoice was issued (refreshed on every
    // draft save until then), so a later edit of the business or customer never changes it.
    t.string('seller_legal_name', 160).notNullable();
    t.specificType('seller_gstin', 'CHAR(15)').notNullable();
    t.string('seller_address', 500).notNullable();
    t.specificType('seller_state_code', 'CHAR(2)').notNullable();
    t.string('customer_name', 160).notNullable();
    t.specificType('customer_gstin', 'CHAR(15)').nullable();
    t.string('customer_address', 500).nullable();
    t.string('notes', 500).nullable();
    totals(t);
    // Kept up to date under the invoice row lock by every payment and credit note, so the
    // balance (grand_total - credited_total - paid_total) needs no SUM over other tables.
    t.decimal('credited_total', ...MONEY).notNullable().defaultTo('0.00');
    t.decimal('paid_total', ...MONEY).notNullable().defaultTo('0.00');
    // Optimistic check: every change adds one; a request with an older version gets 409.
    t.integer('version').unsigned().notNullable().defaultTo(1);
    t.integer('created_by_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('created_by_name', 120).notNullable();
    t.datetime('issued_at', { precision: 3 }).nullable();
    t.datetime('paid_at', { precision: 3 }).nullable();
    t.datetime('cancelled_at', { precision: 3 }).nullable();
    t.string('cancel_reason', 300).nullable();
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.datetime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    // Backstop: even if the lock were wrong, MySQL refuses a second INV/2026-27/0007.
    // Many drafts with a NULL number are allowed (NULLs never clash in a UNIQUE index).
    t.unique(['business_id', 'fy', 'number'], { indexName: 'uq_invoices_business_fy_number' });
    t.index(['business_id', 'status', 'invoice_date'], 'ix_invoices_business_status_date');
    t.index(['business_id', 'invoice_date'], 'ix_invoices_business_date');
  });

  await knex.schema.createTable('invoice_lines', (t) => {
    t.increments('id');
    // CASCADE only matters for deleting a draft: issued invoices are never deleted.
    t.integer('invoice_id').unsigned().notNullable().references('id').inTable('invoices').onDelete('CASCADE');
    t.smallint('position').unsigned().notNullable();
    // RESTRICT: a product can't be deleted while a line uses it. NULL for a line typed by hand.
    t.integer('product_id').unsigned().nullable().references('id').inTable('products');
    t.string('description', 200).notNullable();
    t.string('hsn_sac', 8).notNullable();
    t.decimal('quantity', ...QUANTITY).notNullable();
    t.decimal('price', ...MONEY).notNullable();
    t.decimal('discount', ...MONEY).notNullable().defaultTo('0.00');
    t.decimal('gst_rate', 5, 2).notNullable();
    lineAmounts(t);
    t.unique(['invoice_id', 'position'], { indexName: 'uq_invoice_lines_position' });
  });

  await knex.schema.createTable('credit_notes', (t) => {
    t.increments('id');
    t.integer('business_id').unsigned().notNullable().references('id').inTable('businesses');
    t.integer('invoice_id').unsigned().notNullable().references('id').inTable('invoices');
    // Credit notes have their own gap-free series: CN/2026-27/0001.
    t.integer('number').unsigned().notNullable();
    t.specificType('fy', 'CHAR(7)').notNullable();
    t.date('note_date').notNullable();
    t.string('reason', 300).notNullable();
    totals(t);
    t.integer('created_by_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('created_by_name', 120).notNullable();
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.unique(['business_id', 'fy', 'number'], { indexName: 'uq_credit_notes_business_fy_number' });
    t.index(['business_id', 'note_date'], 'ix_credit_notes_business_date');
  });

  await knex.schema.createTable('credit_note_lines', (t) => {
    t.increments('id');
    t.integer('credit_note_id').unsigned().notNullable().references('id').inTable('credit_notes');
    t.integer('invoice_line_id').unsigned().notNullable().references('id').inTable('invoice_lines');
    t.decimal('quantity', ...QUANTITY).notNullable();
    lineAmounts(t);
  });

  await knex.schema.createTable('payments', (t) => {
    t.increments('id');
    t.integer('business_id').unsigned().notNullable().references('id').inTable('businesses');
    t.integer('invoice_id').unsigned().notNullable().references('id').inTable('invoices');
    t.decimal('amount', ...MONEY).notNullable();
    t.date('paid_on').notNullable();
    t.enu('mode', ['upi', 'bank_transfer', 'cash', 'cheque']).notNullable();
    t.string('reference', 60).nullable();
    t.integer('recorded_by_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('recorded_by_name', 120).notNullable();
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.index(['business_id', 'paid_on'], 'ix_payments_business_date');
  });

  // Every state change and credit note (PROJECTS.md "Done when"), plus settings and team changes.
  // actor_name is copied in, so the entry still names the person after their account is deleted.
  await knex.schema.createTable('audit_logs', (t) => {
    t.bigIncrements('id');
    t.integer('business_id').unsigned().notNullable().references('id').inTable('businesses');
    t.string('entity', 30).notNullable(); // invoice, credit_note, business, team
    t.integer('entity_id').unsigned().notNullable();
    t.string('action', 30).notNullable(); // create, update, issue, payment, paid, cancel, credit, email, ...
    t.string('from_status', 20).nullable();
    t.string('to_status', 20).nullable();
    t.integer('actor_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('actor_name', 120).notNullable();
    t.json('details').nullable();
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.index(['business_id', 'entity', 'entity_id'], 'ix_audit_logs_entity');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('audit_logs');
  await knex.schema.dropTable('payments');
  await knex.schema.dropTable('credit_note_lines');
  await knex.schema.dropTable('credit_notes');
  await knex.schema.dropTable('invoice_lines');
  await knex.schema.dropTable('invoices');
  await knex.schema.dropTable('number_sequences');
};
