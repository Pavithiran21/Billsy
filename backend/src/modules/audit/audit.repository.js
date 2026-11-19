const { knex } = require('../../db/knex');

// The audit trail (PROJECTS.md "Done when": every state change and credit note appears in it).
// A row is always written in the same transaction as the change it describes, so a change can
// never be saved without its audit row, or the other way round.

/**
 * entry: { businessId, entity, entityId, action, fromStatus?, toStatus?, details? }
 * actor: the request context ({ userId, name }); the name is copied in, so the entry still names
 * the person after their account is deleted.
 */
async function record(db, actor, entry) {
  await db('audit_logs').insert({
    business_id: entry.businessId,
    entity: entry.entity,
    entity_id: entry.entityId,
    action: entry.action,
    from_status: entry.fromStatus ?? null,
    to_status: entry.toStatus ?? null,
    actor_user_id: actor.userId,
    actor_name: actor.name,
    details: entry.details ? JSON.stringify(entry.details) : null,
  });
}

/** One entity's history, oldest first (the invoice view's audit log). */
async function listFor(businessId, entity, entityId) {
  const rows = await knex('audit_logs')
    .select('id', 'action', 'from_status', 'to_status', 'actor_name', 'details', 'created_at')
    .where({ business_id: businessId, entity, entity_id: entityId })
    .orderBy('id', 'asc');
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorName: row.actor_name,
    details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
    at: row.created_at,
  }));
}

module.exports = { auditRepository: { record, listFor } };
