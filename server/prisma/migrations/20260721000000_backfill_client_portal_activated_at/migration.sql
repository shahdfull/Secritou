-- SEC-172: 20260711204823_client_portal_activated_at added Client.portalActivatedAt with no
-- backfill. The only write path (invoice.service.ts#addPayment) only fires on a NEW payment
-- event, so any client whose DEPOSIT invoice was already PAID before that migration never gets
-- portalActivatedAt set, and requireActivatedPortal (rbac.middleware.ts) locks them out of their
-- own portal permanently. One-time backfill: activate the portal, using the DEPOSIT invoice's
-- own paidAt as the activation timestamp (falling back to its updatedAt if paidAt is unset) so
-- the value reflects when the deposit was actually paid, not the date this migration runs.
UPDATE "Client" c
SET "portalActivatedAt" = sub."activatedAt"
FROM (
  SELECT i."clientId", MIN(COALESCE(i."paidAt", i."updatedAt")) AS "activatedAt"
  FROM "Invoice" i
  WHERE i."invoiceType" = 'DEPOSIT' AND i."status" = 'PAID'
  GROUP BY i."clientId"
) sub
WHERE c.id = sub."clientId" AND c."portalActivatedAt" IS NULL;
