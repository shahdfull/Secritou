import { Router } from "express";
import * as gdprController from "../controllers/gdpr.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  gdprClientExportSchema,
  gdprClientEraseSchema,
  gdprUserExportSchema,
  gdprUserEraseSchema,
  gdprLeadExportSchema,
  gdprLeadEraseSchema,
  gdprContactRequestExportSchema,
  gdprContactRequestEraseSchema,
  gdprMeSchema,
} from "../validators/gdpr.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();
router.use(authenticate);
// ADMIN only, no MANAGER exception: erasure/export are irreversible-adjacent actions on
// personal data, not scoped to a pôle the way regular Client/User reads are.

/**
 * @swagger
 * /gdpr/clients/{id}/export:
 *   get:
 *     summary: Export all personal data held for a client (RGPD data portability)
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Export bundle (client record, portal users, converted leads, document metadata)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  "/clients/:id/export",
  sensitiveWriteRateLimit, // SEC-225: exports are the costliest read here (signed doc URLs, SEC-222)
  authorize("ADMIN"),
  validate(gdprClientExportSchema),
  gdprController.exportClient
);

/**
 * @swagger
 * /gdpr/clients/{id}/erase:
 *   post:
 *     summary: Erase a client's personal data (RGPD right to erasure)
 *     description: >
 *       Hard-deletes the client (and its converted leads) when no invoice is linked to it.
 *       Otherwise anonymizes name/email/phone in place — invoices and audit records are kept
 *       for legal retention, only the identifying fields are scrubbed.
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: "{ mode: 'deleted' | 'anonymized' }"
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  "/clients/:id/erase",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  validate(gdprClientEraseSchema),
  gdprController.eraseClient
);

/**
 * @swagger
 * /gdpr/users/{id}/export:
 *   get:
 *     summary: Export all personal data held for a user (RGPD data portability)
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Export bundle (user record, freelancer profile if any)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  "/users/:id/export",
  sensitiveWriteRateLimit, // SEC-225
  authorize("ADMIN"),
  validate(gdprUserExportSchema),
  gdprController.exportUser
);

/**
 * @swagger
 * /gdpr/users/{id}/erase:
 *   post:
 *     summary: Erase a user's personal data (RGPD right to erasure)
 *     description: >
 *       Hard-deletes the user when they have no commission/time-tracking history and are not
 *       the last remaining admin. Otherwise anonymizes name/email/phone/bio and revokes their
 *       access tokens — commission and audit records are kept for legal retention.
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: "{ mode: 'deleted' | 'anonymized' }"
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Cannot erase the last remaining admin
 */
router.post(
  "/users/:id/erase",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  validate(gdprUserEraseSchema),
  gdprController.eraseUser
);

/**
 * @swagger
 * /gdpr/leads/{id}/export:
 *   get:
 *     summary: Export all personal data held for a lead (RGPD data portability)
 *     description: >
 *       Delegates to the client export if this lead has already been converted — a converted
 *       lead's identity is the client from that point on.
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Export bundle (lead record, originating contact request if any)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  "/leads/:id/export",
  sensitiveWriteRateLimit, // SEC-225
  authorize("ADMIN"),
  validate(gdprLeadExportSchema),
  gdprController.exportLead
);

/**
 * @swagger
 * /gdpr/leads/{id}/erase:
 *   post:
 *     summary: Erase a lead's personal data (RGPD right to erasure)
 *     description: >
 *       Delegates to client erasure if converted. Otherwise anonymizes when a Proposal is
 *       attached (financial-adjacent), else hard-deletes — and cascades to the originating
 *       ContactRequest (same identity), if any.
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: "{ mode: 'deleted' | 'anonymized' }"
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  "/leads/:id/erase",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  validate(gdprLeadEraseSchema),
  gdprController.eraseLead
);

/**
 * @swagger
 * /gdpr/contact-requests/{id}/export:
 *   get:
 *     summary: Export all personal data held for a public contact form submission (RGPD)
 *     description: Delegates to the lead export if this submission was already converted.
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Export bundle (contact request record)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  "/contact-requests/:id/export",
  sensitiveWriteRateLimit, // SEC-225
  authorize("ADMIN"),
  validate(gdprContactRequestExportSchema),
  gdprController.exportContactRequest
);

/**
 * @swagger
 * /gdpr/contact-requests/{id}/erase:
 *   post:
 *     summary: Erase a contact form submission's personal data (RGPD right to erasure)
 *     description: Delegates to lead erasure if converted, otherwise hard-deletes directly.
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: "{ mode: 'deleted' | 'anonymized' }"
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  "/contact-requests/:id/erase",
  sensitiveWriteRateLimit,
  authorize("ADMIN"),
  validate(gdprContactRequestEraseSchema),
  gdprController.eraseContactRequest
);

// --- Self-service (SEC-224) ---
// No authorize("ADMIN") on purpose: any authenticated user (CLIENT portal, FREELANCER, MANAGER)
// can export/erase their OWN data. Identity comes from req.user.sub in the controller, never a
// URL param, so this can never be used to target another account.

/**
 * @swagger
 * /gdpr/me/export:
 *   get:
 *     summary: Export the authenticated user's own personal data (RGPD self-service)
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Export bundle for the caller's own User record
 */
router.get("/me/export", sensitiveWriteRateLimit, validate(gdprMeSchema), gdprController.exportMe);

/**
 * @swagger
 * /gdpr/me/erase:
 *   post:
 *     summary: Erase the authenticated user's own personal data (RGPD self-service)
 *     description: >
 *       Same hard-delete-or-anonymize logic as the ADMIN-triggered user erasure. Ends the
 *       caller's own session (access token revoked as part of erasure).
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ mode: 'deleted' | 'anonymized' }"
 *       409:
 *         description: Cannot erase the last remaining admin
 */
router.post("/me/erase", sensitiveWriteRateLimit, validate(gdprMeSchema), gdprController.eraseMe);

export default router;
