// What the frontend needs to know about the signed-in person: who they are, their role, and
// their business (or null for someone who left or was removed: /no-business).
// Built from the request context (users.repository findContext).

function toAccountResponse(context) {
  return {
    user: {
      id: context.userId,
      name: context.name,
      email: context.email,
      isDemo: context.isDemo,
    },
    membership: context.businessId
      ? {
          role: context.role,
          business: {
            id: context.business.id,
            legalName: context.business.legalName,
            status: context.business.status,
            isDemo: context.business.isDemo,
            ownerName: context.business.ownerName,
          },
        }
      : null,
  };
}

module.exports = { toAccountResponse };
