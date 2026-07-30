// GDPR export/erasure — RG-025 (see REFERENTIEL.md §5).
//
// Scope, per decision of the project owner (AskUserQuestion, 2026-07-24):
//   - Subjects: Client (+ its converted Leads, treated as the same identity), and User
//     (covers ADMIN/MANAGER/FREELANCER/CLIENT-portal accounts — a single model in this schema).
//   - Erasure semantics: hard delete when the subject has no linked financial record
//     (reuses the exact guards already used by clientService.deleteClient /
//     userService.deleteUser — countInvoices / hasFinancialHistory), otherwise anonymize
//     the PII fields in place and keep the row (financial/audit records must be retained
//     for legal/tax reasons — see README "Data protection notes").
//
// Deliberately does NOT touch the schema (no new column, no migration) — anonymization
// overwrites existing PII fields (name/email/phone/bio/notes) rather than adding an
// "anonymized" marker column, since this environment has no way to run a migration.
import { prisma, prismaRead } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { clientRepository } from "../repositories/client.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { authDenylist } from "../cache/authDenylist.js";
import { auditLogService } from "./auditLog.service.js";
import { invalidateTags } from "../cache/cacheService.js";
import { cacheTags } from "../cache/cacheKeys.js";
import { HttpError } from "../utils/httpError.js";
import { getSignedReadUrl } from "./upload.service.js";
import crypto from "crypto";

type Actor = { id?: string; role?: string; ip?: string };

const ANONYMIZED_NAME = "Anonymisé (RGPD)";
// Exported so tests can derive the exact same target email a real erasure will write (e.g. to
// force a genuine @@unique([email]) collision), instead of hardcoding a parallel copy of this
// derivation that could silently drift from the real one.
export const anonymizedEmail = (id: string) => `anonymized-${id}@deleted.invalid`;

// A foreign key defined without an explicit onDelete (Prisma default) or with
// onDelete: Restrict rejects the delete at the database level (P2003) rather than
// silently cascading. Caught below and treated the same as a known financial-history
// guard: fall back to anonymization instead of surfacing a raw DB error to the caller.
function isRestrictedDeleteError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";
}

export const gdprService = {
  async exportClient(id: string) {
    const client = await prismaRead.client.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true,
        createdAt: true, updatedAt: true, archivedAt: true, deletedAt: true,
      },
    });
    if (!client) throw new HttpError(404, "Client not found");

    const [portalUsers, convertedLeads, documents] = await Promise.all([
      prismaRead.user.findMany({
        where: { clientId: id },
        select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, lastLoginAt: true },
      }),
      prismaRead.lead.findMany({
        where: { convertedClientId: id },
        select: { id: true, name: true, email: true, phone: true, notes: true, source: true, createdAt: true },
      }),
      prismaRead.document.findMany({
        where: { clientId: id },
        select: { id: true, type: true, name: true, fileKey: true, createdAt: true },
      }),
    ]);

    // SEC-222: metadata alone doesn't satisfy data portability (RGPD art. 20) — attach a
    // short-lived signed URL (same TTL as document.service.ts#getDownloadUrl) per document,
    // never the raw fileKey.
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => ({
        id: doc.id,
        type: doc.type,
        name: doc.name,
        createdAt: doc.createdAt,
        downloadUrl: doc.fileKey ? await getSignedReadUrl(doc.fileKey, 3600) : null,
      }))
    );

    return {
      subjectType: "client" as const,
      client,
      portalUsers,
      convertedLeads,
      documents: documentsWithUrls,
      exportedAt: new Date().toISOString(),
    };
  },

  async eraseClient(id: string, actor?: Actor) {
    const client = await clientRepository.findById(id, undefined, true);
    if (!client) throw new HttpError(404, "Client not found");

    const invoiceCount = await clientRepository.countInvoices(id);

    // SEC-037: every DB write for this erasure is grouped in one interactive transaction — a
    // mid-sequence failure (crash, network) must never leave the Client deleted/anonymized while
    // its related Leads or portal Users are still untouched (or the reverse). authDenylist calls
    // stay outside the transaction (not a DB write) but are only reached once the transaction has
    // actually committed, so a rolled-back erasure never revokes a session for nothing.
    let mode: "deleted" | "anonymized";
    let portalUserIds: string[] = [];
    if (invoiceCount === 0) {
      try {
        mode = await prisma.$transaction(async (tx) => {
          // Related leads carry the same personal identity — erased together, not left behind.
          const relatedLeads = await tx.lead.findMany({ where: { convertedClientId: id }, select: { id: true } });
          for (const lead of relatedLeads) {
            await tx.lead.delete({ where: { id: lead.id } });
          }
          await tx.client.delete({ where: { id } });
          return "deleted" as const;
        });
      } catch (err) {
        if (!isRestrictedDeleteError(err)) throw err;
        mode = "anonymized";
      }
    } else {
      mode = "anonymized";
    }

    if (mode === "anonymized") {
      portalUserIds = await prisma.$transaction(async (tx) => {
        await tx.client.update({
          where: { id },
          data: { name: ANONYMIZED_NAME, email: anonymizedEmail(id), phone: null },
        });
        const relatedLeads = await tx.lead.findMany({ where: { convertedClientId: id }, select: { id: true } });
        for (const lead of relatedLeads) {
          await tx.lead.update({
            where: { id: lead.id },
            data: { name: ANONYMIZED_NAME, email: null, phone: null, notes: null },
          });
        }
        const portalUsers = await tx.user.findMany({ where: { clientId: id }, select: { id: true } });
        for (const user of portalUsers) {
          await tx.user.update({
            where: { id: user.id },
            data: { name: ANONYMIZED_NAME, email: anonymizedEmail(user.id), phone: null },
          });
        }
        return portalUsers.map((u) => u.id);
      });
    }

    for (const userId of portalUserIds) {
      await authDenylist.revokeAccessToken({ sub: userId });
    }

    await invalidateTags([cacheTags.company(), cacheTags.dashboard(), cacheTags.client(id)]);
    void auditLogService.record({
      actorId: actor?.id, actorRole: actor?.role, ipAddress: actor?.ip,
      action: mode === "deleted" ? "GDPR_CLIENT_ERASED" : "GDPR_CLIENT_ANONYMIZED",
      entityType: "Client", entityId: id,
      before: { name: client.name, email: client.email },
    });

    return { mode };
  },

  async exportUser(id: string) {
    const user = await prismaRead.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        createdAt: true, lastLoginAt: true,
        freelancerProfile: {
          select: {
            bio: true, hourlyRate: true, availability: true,
            skills: { select: { name: true } },
            portfolio: { select: { title: true, description: true, url: true, createdAt: true } },
          },
        },
      },
    });
    if (!user) throw new HttpError(404, "User not found");

    return { subjectType: "user" as const, user, exportedAt: new Date().toISOString() };
  },

  async eraseUser(id: string, actor?: Actor) {
    const user = await userRepository.findById(id);
    if (!user) throw new HttpError(404, "User not found");

    if (user.role === "ADMIN") {
      const adminCount = await userRepository.countByRole("ADMIN");
      if (adminCount <= 1) throw new HttpError(409, "Cannot erase the last remaining admin", "LAST_ADMIN");
    }

    const hasFinancialHistory = await userRepository.hasFinancialHistory(id);
    let mode: "deleted" | "anonymized";

    // SEC-037: the anonymize path writes both User and FreelancerProfile — grouped in one
    // transaction so a mid-sequence failure never leaves the account half-anonymized (e.g.
    // password invalidated but bio still exposed, or the reverse).
    if (!hasFinancialHistory) {
      try {
        await prisma.user.delete({ where: { id } });
        mode = "deleted";
      } catch (err) {
        if (!isRestrictedDeleteError(err)) throw err;
        mode = "anonymized";
      }
    } else {
      mode = "anonymized";
    }

    if (mode === "anonymized") {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: {
            name: ANONYMIZED_NAME,
            email: anonymizedEmail(id),
            phone: null,
            // Invalidate the password too — a random value the account owner can never know,
            // consistent with them no longer being able to authenticate as this identity.
            passwordHash: crypto.randomUUID(),
          },
        });
        await tx.freelancerProfile.updateMany({ where: { userId: id }, data: { bio: null } });
      });
    }

    await authDenylist.revokeAccessToken({ sub: id });

    void auditLogService.record({
      actorId: actor?.id, actorRole: actor?.role, ipAddress: actor?.ip,
      action: mode === "deleted" ? "GDPR_USER_ERASED" : "GDPR_USER_ANONYMIZED",
      entityType: "User", entityId: id,
      before: { name: user.name, email: user.email, role: user.role },
    });

    return { mode };
  },

  // --- Lead (SEC-220) ---
  // A Lead not yet converted to a Client is the same "Client / contact" scope the project
  // owner already approved (AskUserQuestion, 2026-07-24) — this fills a gap in that scope,
  // not a new decision. Delegates to eraseClient/exportClient once converted: a converted
  // Lead's identity IS the Client from that point on, not a separate record to erase twice.
  async exportLead(id: string) {
    const lead = await prismaRead.lead.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, source: true, status: true, notes: true,
        convertedClientId: true, sourceContactId: true, department: true, lostReason: true,
        createdAt: true, updatedAt: true, archivedAt: true,
      },
    });
    if (!lead) throw new HttpError(404, "Lead not found");

    if (lead.convertedClientId) {
      return gdprService.exportClient(lead.convertedClientId);
    }

    const sourceContact = lead.sourceContactId
      ? await prismaRead.contactRequest.findUnique({
          where: { id: lead.sourceContactId },
          select: { id: true, name: true, email: true, phone: true, message: true, createdAt: true },
        })
      : null;

    return { subjectType: "lead" as const, lead, sourceContact, exportedAt: new Date().toISOString() };
  },

  async eraseLead(id: string, actor?: Actor) {
    const lead = await prismaRead.lead.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, convertedClientId: true, sourceContactId: true },
    });
    if (!lead) throw new HttpError(404, "Lead not found");

    if (lead.convertedClientId) {
      return gdprService.eraseClient(lead.convertedClientId, actor);
    }

    // A Proposal is treated as financial-adjacent the same way an unpaid Invoice guards a
    // Client — kept, anonymized in place, rather than hard-deleted (Proposal.leadId is
    // onDelete: SetNull at the DB level, so a hard delete would not actually fail; anonymizing
    // anyway is a deliberate choice to keep the Lead row a Proposal can still point back to).
    const proposal = await prismaRead.proposal.findUnique({ where: { leadId: id }, select: { id: true } });
    let mode: "deleted" | "anonymized";

    if (!proposal) {
      try {
        await prisma.lead.delete({ where: { id } });
        mode = "deleted";
      } catch (err) {
        if (!isRestrictedDeleteError(err)) throw err;
        mode = "anonymized";
      }
    } else {
      mode = "anonymized";
    }

    if (mode === "anonymized") {
      await prisma.lead.update({
        where: { id },
        data: { name: ANONYMIZED_NAME, email: null, phone: null, notes: null },
      });
    }

    // Same identity as the ContactRequest this Lead originated from (if any) — cascaded the
    // same way eraseClient cascades into its converted Leads. Falls back to anonymize if the
    // delete is ever rejected, rather than silently leaving PII behind.
    if (lead.sourceContactId) {
      const contactId = lead.sourceContactId;
      if (mode === "deleted") {
        try {
          await prisma.contactRequest.delete({ where: { id: contactId } });
        } catch (err) {
          if (!isRestrictedDeleteError(err)) throw err;
          await prisma.contactRequest.update({
            where: { id: contactId },
            data: { name: ANONYMIZED_NAME, email: anonymizedEmail(contactId), phone: null, company: ANONYMIZED_NAME, message: "(supprimé — RGPD)" },
          });
        }
      } else {
        await prisma.contactRequest.update({
          where: { id: contactId },
          data: { name: ANONYMIZED_NAME, email: anonymizedEmail(contactId), phone: null, company: ANONYMIZED_NAME, message: "(supprimé — RGPD)" },
        });
      }
    }

    void auditLogService.record({
      actorId: actor?.id, actorRole: actor?.role, ipAddress: actor?.ip,
      action: mode === "deleted" ? "GDPR_LEAD_ERASED" : "GDPR_LEAD_ANONYMIZED",
      entityType: "Lead", entityId: id,
      before: { name: lead.name, email: lead.email },
    });

    return { mode };
  },

  // --- ContactRequest (SEC-221) ---
  // Upstream of Lead (Lead.sourceContactId). Delegates to eraseLead/exportLead once converted,
  // which itself delegates to eraseClient/exportClient once that Lead is converted — one entry
  // point at any stage of the chain reaches the same end state.
  async exportContactRequest(id: string) {
    const contactRequest = await prismaRead.contactRequest.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, serviceType: true, budget: true,
        company: true, message: true, status: true, convertedAt: true, createdAt: true, updatedAt: true,
      },
    });
    if (!contactRequest) throw new HttpError(404, "Contact request not found");

    const convertedLead = await prismaRead.lead.findFirst({ where: { sourceContactId: id }, select: { id: true } });
    if (convertedLead) {
      return gdprService.exportLead(convertedLead.id);
    }

    return { subjectType: "contactRequest" as const, contactRequest, exportedAt: new Date().toISOString() };
  },

  async eraseContactRequest(id: string, actor?: Actor) {
    const contactRequest = await prismaRead.contactRequest.findUnique({
      where: { id },
      select: { id: true, name: true, email: true },
    });
    if (!contactRequest) throw new HttpError(404, "Contact request not found");

    const convertedLead = await prismaRead.lead.findFirst({ where: { sourceContactId: id }, select: { id: true } });
    if (convertedLead) {
      return gdprService.eraseLead(convertedLead.id, actor);
    }

    // Nothing else in the schema references ContactRequest (only Lead.sourceContactId, already
    // ruled out above via convertedLead) — the try/catch is defensive, not expected to trigger.
    let mode: "deleted" | "anonymized";
    try {
      await prisma.contactRequest.delete({ where: { id } });
      mode = "deleted";
    } catch (err) {
      if (!isRestrictedDeleteError(err)) throw err;
      mode = "anonymized";
    }

    if (mode === "anonymized") {
      await prisma.contactRequest.update({
        where: { id },
        data: { name: ANONYMIZED_NAME, email: anonymizedEmail(id), phone: null, company: ANONYMIZED_NAME, message: "(supprimé — RGPD)" },
      });
    }

    void auditLogService.record({
      actorId: actor?.id, actorRole: actor?.role, ipAddress: actor?.ip,
      action: mode === "deleted" ? "GDPR_CONTACT_REQUEST_ERASED" : "GDPR_CONTACT_REQUEST_ANONYMIZED",
      entityType: "ContactRequest", entityId: id,
      before: { name: contactRequest.name, email: contactRequest.email },
    });

    return { mode };
  },
};
