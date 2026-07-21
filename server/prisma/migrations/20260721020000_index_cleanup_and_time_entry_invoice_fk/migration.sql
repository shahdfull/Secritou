-- SEC-111: ServiceRequest.priority/type are used as WHERE filters (serviceRequest.repository.ts)
-- but had no index.
CREATE INDEX "ServiceRequest_priority_idx" ON "ServiceRequest"("priority");
CREATE INDEX "ServiceRequest_type_idx" ON "ServiceRequest"("type");

-- SEC-112: documentRepository.findLatestByProjectAndType filters on (projectId, type) together.
CREATE INDEX "Document_projectId_type_idx" ON "Document"("projectId", "type");

-- SEC-113: managerPermissionRepository.findUserIdsByProfileId filters on profileId, called on
-- every PermissionProfile update/delete to invalidate manager permission caches.
CREATE INDEX "ManagerPermission_profileId_idx" ON "ManagerPermission"("profileId");

-- SEC-166: TimeEntry.billedInvoiceId was a bare String with no FK/index — no referential
-- integrity, no way to look up "which time entries were billed on this invoice". onDelete SET
-- NULL: invoices are never hard-deleted in practice (no deletedAt-bypassing path found), but a
-- billed time entry must survive even if one somehow were.
CREATE INDEX "TimeEntry_billedInvoiceId_idx" ON "TimeEntry"("billedInvoiceId");
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_billedInvoiceId_fkey" FOREIGN KEY ("billedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SEC-167: @@unique already creates its own B-tree index — a separate @@index on the exact same
-- column(s) is a pure write-cost/space duplicate the query planner never uses.
DROP INDEX "User_email_idx";
DROP INDEX "FreelancerApplication_email_idx";
DROP INDEX "Payment_idempotencyKey_idx";
