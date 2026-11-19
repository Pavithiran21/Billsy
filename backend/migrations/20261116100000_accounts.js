// Users, businesses, the membership that ties them (one business per user), invitations and the
// login tokens. Conventions (BACKEND.md "Migrations"): InnoDB, utf8mb4, INT UNSIGNED ids,
// DATETIME(3) timestamps in UTC, CHAR(2) state codes, a foreign key on every reference.

exports.up = async function up(knex) {
  await knex.schema.createTable('users', (t) => {
    t.increments('id');
    t.string('name', 120).notNullable();
    t.string('email', 254).notNullable().unique({ indexName: 'uq_users_email' });
    t.string('password_hash', 100).notNullable();
    // Demo accounts can't change their email or password, leave or be deleted.
    t.boolean('is_demo').notNullable().defaultTo(false);
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.datetime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
  });

  await knex.schema.createTable('businesses', (t) => {
    t.increments('id');
    t.string('legal_name', 160).notNullable();
    // One business per GSTIN on Billsy.
    t.specificType('gstin', 'CHAR(15)').notNullable().unique({ indexName: 'uq_businesses_gstin' });
    t.string('address', 500).notNullable();
    t.specificType('state_code', 'CHAR(2)').notNullable();
    // The logo lives in MySQL (PROJECTS.md, Uploads): PNG or JPEG up to 1 MB. List queries never
    // select this column; only GET /api/business/logo reads it.
    t.specificType('logo', 'LONGBLOB').nullable();
    t.string('logo_mime', 20).nullable();
    t.datetime('logo_updated_at', { precision: 3 }).nullable();
    // A business is never deleted, only deactivated (PROJECTS.md, Billsy Note).
    t.enu('status', ['active', 'deactivated']).notNullable().defaultTo('active');
    t.datetime('status_changed_at', { precision: 3 }).nullable();
    t.string('status_changed_by_name', 120).nullable();
    t.boolean('is_demo').notNullable().defaultTo(false);
    t.integer('version').unsigned().notNullable().defaultTo(1);
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.datetime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
  });

  await knex.schema.createTable('memberships', (t) => {
    t.increments('id');
    // UNIQUE: in the MVP each user belongs to one business. Leaving deletes the row.
    t.integer('user_id').unsigned().notNullable().unique({ indexName: 'uq_memberships_user' })
      .references('id').inTable('users').onDelete('CASCADE');
    t.integer('business_id').unsigned().notNullable().references('id').inTable('businesses');
    t.enu('role', ['owner', 'accountant', 'staff']).notNullable();
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.index(['business_id', 'role'], 'ix_memberships_business_role');
  });

  await knex.schema.createTable('invitations', (t) => {
    t.increments('id');
    t.integer('business_id').unsigned().notNullable().references('id').inTable('businesses');
    t.string('email', 254).notNullable();
    t.enu('role', ['accountant', 'staff']).notNullable();
    // SHA-256 of the 32 random bytes in the link; the link itself is never stored.
    t.specificType('token_hash', 'CHAR(64)').notNullable().unique({ indexName: 'uq_invitations_token' });
    t.integer('invited_by_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('invited_by_name', 120).notNullable();
    t.datetime('expires_at', { precision: 3 }).notNullable();
    t.datetime('accepted_at', { precision: 3 }).nullable();
    t.datetime('revoked_at', { precision: 3 }).nullable();
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.index(['business_id', 'email'], 'ix_invitations_business_email');
  });

  await knex.schema.createTable('refresh_tokens', (t) => {
    t.increments('id');
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.specificType('token_hash', 'CHAR(64)').notNullable().unique({ indexName: 'uq_refresh_tokens_hash' });
    t.datetime('expires_at', { precision: 3 }).notNullable();
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
  });

  await knex.schema.createTable('password_reset_tokens', (t) => {
    t.increments('id');
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.specificType('token_hash', 'CHAR(64)').notNullable().unique({ indexName: 'uq_reset_tokens_hash' });
    t.datetime('expires_at', { precision: 3 }).notNullable();
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('password_reset_tokens');
  await knex.schema.dropTable('refresh_tokens');
  await knex.schema.dropTable('invitations');
  await knex.schema.dropTable('memberships');
  await knex.schema.dropTable('businesses');
  await knex.schema.dropTable('users');
};
