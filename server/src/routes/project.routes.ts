import { Router } from "express";
import { getAllProjects, getProjectById, createProject, updateProject, deleteProject, archiveProject, unarchiveProject, getDeletedProjects, restoreProject, getMyProjects, getTimelineStatus, getCompletedTasks, getPortalSummaries, getBrief, submitBrief, clientApproveProject, receiveAiSpecs } from "../controllers/project.controller.js";
import { getHealthBoard } from "../controllers/healthBoard.controller.js";
import { createTimeEntry, listTimeEntries, getTimeSummary, getMyTimeSummary } from "../controllers/timeEntry.controller.js";
import { listProjectMeetings, createProjectMeeting, updateProjectMeeting, deleteProjectMeeting, getMeetingSchedule, updateMeetingSchedule } from "../controllers/projectMeeting.controller.js";
import { createProjectMeetingSchema, updateProjectMeetingSchema, deleteProjectMeetingSchema, updateMeetingScheduleSchema } from "../validators/projectMeeting.validator.js";
import { applyTemplateToProject } from "../controllers/projectTemplate.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createProjectSchema, updateProjectSchema, getPortalSummariesSchema } from "../validators/project.validator.js";
import { createTimeEntrySchema } from "../validators/timeEntry.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission, requireActivatedPortal } from "../middlewares/rbac.middleware.js";
import { verifyN8nWebhook } from "../middlewares/verifyN8nWebhook.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";
const router = Router();

/**
 * @swagger
 * /projects/health-board:
 *   get:
 *     summary: Get the project health board (red/orange/green scoring)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: MANAGER is always scoped to their own pôle; ADMIN may optionally filter by ?serviceId=.
 *     parameters:
 *       - in: query
 *         name: serviceId
 *         schema: { type: string, format: uuid }
 *         description: ADMIN only — ignored (overridden by own pôle) for MANAGER.
 *     responses:
 *       200:
 *         description: Health board data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/health-board", authenticate, authorize("ADMIN", "MANAGER"), requirePermission("projects", "read"), getHealthBoard);

/**
 * @swagger
 * /projects/my:
 *   get:
 *     summary: List the current client's own projects
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       CLIENT only, scoped to req.user.clientId. Requires an activated client portal
 *       (requireActivatedPortal) — ongoing project visibility only starts once the deposit
 *       invoice is paid.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Paginated list of the client's projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden — wrong role or portal not yet activated
 */
// Ongoing project visibility is the cadrage's "Exécution & suivi" step, which comes after
// the deposit is paid — gated.
router.get("/my", authenticate, authorize("CLIENT"), requireActivatedPortal, getMyProjects);

/**
 * @swagger
 * /projects/trash:
 *   get:
 *     summary: List soft-deleted projects (ADMIN/MANAGER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: MANAGER is scoped to their own pôle.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Paginated list of soft-deleted projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/trash", authenticate, authorize("ADMIN", "MANAGER"), requirePermission("projects", "read"), getDeletedProjects);

/**
 * @swagger
 * /projects/{id}/timeline-status:
 *   get:
 *     summary: Get the synthetic 7-step timeline status of a project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Accessible to CLIENT (own project only), MANAGER (own pôle only), FREELANCER (own
 *       assigned task only), and ADMIN — not gated by portal activation (unlike /my), each
 *       scoped inside the service layer.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Ordered list of the project's cadrage/execution steps and their status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Timeline : accessible to CLIENT (own project only), MANAGER (own pole only), FREELANCER (own
// task only), ADMIN — not gated (payment activation), each scoped inside the service. authorize
// added explicitly (SEC, session 2026-07-18) as a router-level safety net, not the sole guard —
// a future added role or a service scoping mistake would otherwise fall through silently.
router.get("/:id/timeline-status", authenticate, authorize("ADMIN", "MANAGER", "CLIENT", "FREELANCER"), getTimelineStatus);

/**
 * @swagger
 * /projects/{id}/completed-tasks:
 *   get:
 *     summary: List completed tasks for the current client's project (simplified client view)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       CLIENT only, scoped to req.user.clientId. Not gated by requireActivatedPortal, same
 *       visibility condition as GET /projects/my. Distinct from the synthetic timeline above —
 *       returns real task rows (title + completion date).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Completed tasks for the project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
// SEC-061 : vue CLIENT simplifiée (titre + date) des tâches terminées, distincte de la timeline
// synthétique ci-dessus — CLIENT seul, mêmes conditions de visibilité que "/my" (portail continu,
// pas gated par requireActivatedPortal, cohérent avec la timeline déjà non gated).
router.get("/:id/completed-tasks", authenticate, authorize("CLIENT"), getCompletedTasks);

/**
 * @swagger
 * /projects/my/summaries:
 *   get:
 *     summary: Batched timeline + completed-tasks summaries for multiple client projects
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       CLIENT only, scoped to req.user.clientId. Batches /:id/timeline-status +
 *       /:id/completed-tasks for every id in one call (SEC-091) — ProjectsClientPage.tsx used to
 *       fire both separately for every visible project card. An id not owned by the caller (or
 *       nonexistent) is silently omitted from the response rather than failing the whole batch.
 *     parameters:
 *       - in: query
 *         name: ids
 *         required: true
 *         schema: { type: string }
 *         description: Comma-separated project UUIDs, up to 100.
 *     responses:
 *       200:
 *         description: Map of projectId to { timeline, completedTasks }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 */
// Static path — must be registered before GET /:id below to avoid being swallowed as a param.
router.get("/my/summaries", authenticate, authorize("CLIENT"), validate(getPortalSummariesSchema), getPortalSummaries);

/**
 * @swagger
 * /projects/{id}/brief:
 *   get:
 *     summary: Get the project's cadrage brief questionnaire
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       CLIENT (own project), MANAGER (own pôle), ADMIN read the full brief. FREELANCER (own
 *       assigned task only) gets a redacted view — only whether the brief is complete, not its
 *       content (briefData may hold confidential client objectives/budget).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Brief data (full for CLIENT/MANAGER/ADMIN, redacted for FREELANCER)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Brief questionnaire : CLIENT submits, MANAGER (own pole)/ADMIN/FREELANCER (own task, redacted)
// read. Submitting the brief is the cadrage's "2e réunion de cadrage" step, which happens after
// the deposit is paid — gated. authorize added explicitly (SEC, session 2026-07-18), see above.
router.get("/:id/brief", authenticate, authorize("ADMIN", "MANAGER", "CLIENT", "FREELANCER"), getBrief);

/**
 * @swagger
 * /projects/{id}/brief/submit:
 *   post:
 *     summary: Submit the cadrage brief questionnaire
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       CLIENT only, own project, requires an activated portal. This is the cadrage's "2e
 *       réunion de cadrage" step. 409 BRIEF_ALREADY_SUBMITTED if the brief was already
 *       completed — this endpoint is not a re-submission/edit path.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Free-form questionnaire answers — shape defined by the front-end brief form, not a fixed schema server-side.
 *     responses:
 *       200:
 *         description: Brief submitted, project marked briefCompleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden — wrong role, portal not activated, or project belongs to another client
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: BRIEF_ALREADY_SUBMITTED — the brief was already completed
 */
router.post("/:id/brief/submit", authenticate, sensitiveWriteRateLimit, authorize("CLIENT"), requireActivatedPortal, submitBrief);

/**
 * @swagger
 * /projects/{id}/ai-specs:
 *   patch:
 *     summary: n8n callback — deliver AI-generated specs/roadmap for a submitted brief
 *     tags: [Projects]
 *     description: >
 *       Called back by the n8n brief-to-specs workflow, NOT by an authenticated Secritou user —
 *       gated by HMAC signature (verifyN8nWebhook middleware), not a Bearer token. A normal
 *       REST client with a user session cannot call this route. Generated documents are
 *       attributed to the first ADMIN found (n8n has no notion of which manager triggered the
 *       brief). At least one of `sections`/`roadmap` is required; either or both may be sent,
 *       whichever regenerates in a single callback.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sections:
 *                 type: object
 *                 description: SPECS document content, regenerated when present.
 *               roadmap:
 *                 type: object
 *                 description: ROADMAP document content, regenerated when present.
 *     responses:
 *       200:
 *         description: Documents regenerated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     specs: { type: object }
 *                     roadmap: { type: object }
 *       400:
 *         description: MISSING_AI_SPECS_PAYLOAD — neither sections nor roadmap provided
 *       401:
 *         description: Invalid or missing HMAC webhook signature
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: NO_ADMIN_FOUND — no ADMIN user exists to attribute the generated document to
 */
// Called back by the n8n brief-to-specs workflow — gated by HMAC signature, not a Secritou session.
router.patch("/:id/ai-specs", verifyN8nWebhook, receiveAiSpecs);

/**
 * @swagger
 * /projects/{id}/client-approve:
 *   post:
 *     summary: Client gives final project approval
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       CLIENT only, own project, requires an activated portal. Triggers the project's final
 *       cascade: status → COMPLETED and generation of the balance invoice. Deep in execution —
 *       necessarily happens after the deposit invoice is already paid.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Project approved — status set to COMPLETED, balance invoice generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden — wrong role, portal not activated, or project belongs to another client
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: >
 *           PROJECT_ALREADY_APPROVED — already approved by the client;
 *           PROJECT_ALREADY_COMPLETED — project already completed;
 *           PROJECT_NOT_IN_REVIEW — project has not reached the REVIEW status yet;
 *           DEPOSIT_UNPAID — the deposit invoice must be paid first;
 *           PENDING_APPROVALS_REMAINING — one or more Approval items are still PENDING/REJECTED.
 *           OPEN_TASKS_REMAINING (400, not 409) — one or more tasks are not yet DONE.
 */
// Client final approval : triggers project COMPLETED + balance invoice — deep in execution,
// necessarily after the deposit is paid.
router.post("/:id/client-approve", authenticate, sensitiveWriteRateLimit, authorize("CLIENT"), requireActivatedPortal, clientApproveProject);

// Apply auth middleware to all admin/manager routes
router.use(authenticate);

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: Get all projects
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", requirePermission("projects", "read"), getAllProjects);

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get project by ID
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Project details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", requirePermission("projects", "read"), getProjectById);

/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a project from an already-accepted proposal
 *     description: >
 *       Low-level route: a project is normally created automatically by the accept-proposal
 *       cascade (proposal.service.ts), not by this endpoint — no UI screen calls it. `proposalId`
 *       is REQUIRED and must reference a proposal whose status is ACCEPTED, otherwise the request
 *       is rejected (404 if the proposal does not exist, 422 PROPOSAL_NOT_ACCEPTED otherwise).
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, proposalId]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               proposalId: { type: string, format: uuid, description: "Must reference an ACCEPTED proposal" }
 *               clientId: { type: string, format: uuid }
 *               status: { type: string, enum: [PLANNING, IN_PROGRESS, REVIEW, COMPLETED], default: PLANNING }
 *               serviceId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Project created
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Proposal not found
 *       422:
 *         description: >
 *           Either a Zod validation error (see ValidationError schema), or
 *           PROPOSAL_NOT_ACCEPTED — the referenced proposal is not in ACCEPTED status.
 */
router.post("/", sensitiveWriteRateLimit, validate(createProjectSchema), authorize("ADMIN", "MANAGER"), requirePermission("projects", "create"), createProject);

/**
 * @swagger
 * /projects/{id}:
 *   put:
 *     summary: Update project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Also the only way to change a project's status (not just name/description). COMPLETED
 *       cannot be set directly here — it's only reachable via POST /projects/{id}/client-approve
 *       (422 COMPLETION_REQUIRES_CLIENT_APPROVAL otherwise). Any other transition not allowed by
 *       PROJECT_STATUS_VALID_TRANSITIONS returns 422 INVALID_STATUS_TRANSITION.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               status: { type: string, enum: [PLANNING, IN_PROGRESS, REVIEW, COMPLETED] }
 *               serviceId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Project updated
 *       422:
 *         description: >
 *           Zod validation error, COMPLETION_REQUIRES_CLIENT_APPROVAL, or
 *           INVALID_STATUS_TRANSITION — see description above.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put("/:id", sensitiveWriteRateLimit, validate(updateProjectSchema), authorize("ADMIN", "MANAGER"), requirePermission("projects", "update"), updateProject);

/**
 * @swagger
 * /projects/{id}:
 *   delete:
 *     summary: Delete project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Project deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
/**
 * @swagger
 * /projects/{id}:
 *   delete:
 *     summary: Soft-delete a project (ADMIN only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       ADMIN-only (unlike task deletion, which also allows MANAGER) — cascades to all of the
 *       project's tasks and is gated by invoice/onboarding checks in project.service.ts. See
 *       POST /projects/{id}/restore to undo, GET /projects/trash to list.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Project soft-deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// ADMIN-only (unlike task deletion, which also allows MANAGER): deleting/archiving/restoring
// a project is a higher-impact action that cascades to all of its tasks and is gated by
// invoice/onboarding checks in project.service.ts — kept consistent with archive/restore
// below rather than opened up to MANAGER.
router.delete("/:id", sensitiveWriteRateLimit, authorize("ADMIN"), deleteProject);

/**
 * @swagger
 * /projects/{id}/archive:
 *   post:
 *     summary: Archive a project (ADMIN only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Project archived
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/archive", sensitiveWriteRateLimit, authorize("ADMIN"), archiveProject);

/**
 * @swagger
 * /projects/{id}/unarchive:
 *   post:
 *     summary: Unarchive a project (ADMIN only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Project unarchived
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/unarchive", sensitiveWriteRateLimit, authorize("ADMIN"), unarchiveProject);

/**
 * @swagger
 * /projects/{id}/restore:
 *   post:
 *     summary: Restore a soft-deleted project (ADMIN only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Project restored
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/restore", sensitiveWriteRateLimit, authorize("ADMIN"), restoreProject);

/**
 * @swagger
 * /projects/{id}/time-entries:
 *   post:
 *     summary: Log a time entry against a project (ADMIN/MANAGER/FREELANCER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [minutes, date]
 *             properties:
 *               taskId: { type: string, format: uuid }
 *               description: { type: string, maxLength: 500 }
 *               minutes: { type: integer, minimum: 1, maximum: 1440 }
 *               date: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Time entry created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   get:
 *     summary: List time entries for a project (ADMIN/MANAGER/FREELANCER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of time entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
// Time tracking
router.post("/:id/time-entries", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER", "FREELANCER"), validate(createTimeEntrySchema), createTimeEntry);
router.get("/:id/time-entries", authorize("ADMIN", "MANAGER", "FREELANCER"), listTimeEntries);

/**
 * @swagger
 * /projects/{id}/time-summary:
 *   get:
 *     summary: Get the total logged time summary for a project (ADMIN only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Time summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/:id/time-summary", authorize("ADMIN"), getTimeSummary);

/**
 * @swagger
 * /projects/{id}/my-time-summary:
 *   get:
 *     summary: Get the current user's own logged time summary for a project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: ADMIN/MANAGER/FREELANCER — scoped to the caller's own entries.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Own time summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/:id/my-time-summary", authorize("ADMIN", "MANAGER", "FREELANCER"), getMyTimeSummary);

/**
 * @swagger
 * /projects/{id}/apply-template:
 *   post:
 *     summary: Apply the project's pôle task template (one-shot bulk task creation)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       ADMIN/MANAGER (own pôle). Idempotency guard prevents duplicate application on the same
 *       project — a second call is a no-op rather than duplicating the task batch.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Template tasks created (or no-op if already applied)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Templates — apply the project's pole template as a one-shot bulk task creation
router.post("/:id/apply-template", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), requirePermission("projects", "update"), applyTemplateToProject);

/**
 * @swagger
 * /projects/{id}/meetings:
 *   get:
 *     summary: List meeting notes for a project (ADMIN/MANAGER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: No client/freelancer visibility. MANAGER scoped to own pôle.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *         description: Optional — omit for an unpaginated result.
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, maximum: 50 }
 *     responses:
 *       200:
 *         description: Meeting notes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *   post:
 *     summary: Log a new meeting note for a project (ADMIN/MANAGER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [meetingDate]
 *             properties:
 *               meetingDate: { type: string, format: date-time }
 *               participants: { type: string, maxLength: 2000 }
 *               notes: { type: string, maxLength: 5000 }
 *     responses:
 *       201:
 *         description: Meeting note created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Meetings — lightweight log, ADMIN/MANAGER only (no client/freelancer visibility). Update/delete
// (SEC-055/F6) additionally require, at the service layer, that the actor is the meeting's own
// author or ADMIN — requirePermission("projects", "update") alone would let any MANAGER of the
// project's pole edit a colleague's meeting note.
router.get("/:id/meetings", authorize("ADMIN", "MANAGER"), requirePermission("projects", "read"), listProjectMeetings);
router.post("/:id/meetings", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), requirePermission("projects", "update"), validate(createProjectMeetingSchema), createProjectMeeting);

/**
 * @swagger
 * /projects/{id}/meetings/{meetingId}:
 *   put:
 *     summary: Update a meeting note (ADMIN/MANAGER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       The actor must be the meeting's own author, or ADMIN — a MANAGER of the same pôle
 *       cannot edit a colleague's meeting note (checked at the service layer, not just
 *       requirePermission).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: meetingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               meetingDate: { type: string, format: date-time }
 *               participants: { type: string, maxLength: 2000 }
 *               notes: { type: string, maxLength: 5000 }
 *     responses:
 *       200:
 *         description: Meeting note updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden — not the meeting's author and not ADMIN
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Delete a meeting note (ADMIN/MANAGER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: Same author-or-ADMIN restriction as PUT, enforced at the service layer.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: meetingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Meeting note deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden — not the meeting's author and not ADMIN
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put("/:id/meetings/:meetingId", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), requirePermission("projects", "update"), validate(updateProjectMeetingSchema), updateProjectMeeting);
router.delete("/:id/meetings/:meetingId", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), requirePermission("projects", "update"), validate(deleteProjectMeetingSchema), deleteProjectMeeting);

/**
 * @swagger
 * /projects/{id}/meeting-schedule:
 *   get:
 *     summary: Get the project's recurring meeting cadence (ADMIN/MANAGER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     description: Drives the daily reminder job (checkMeetingReminders).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Meeting cadence
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     frequency:
 *                       type: string
 *                       enum: [NONE, WEEKLY, BIWEEKLY, MONTHLY]
 *                     nextMeetingDate:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *   put:
 *     summary: Set the project's recurring meeting cadence (ADMIN/MANAGER)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [frequency]
 *             properties:
 *               frequency:
 *                 type: string
 *                 enum: [NONE, WEEKLY, BIWEEKLY, MONTHLY]
 *               nextMeetingDate:
 *                 type: string
 *                 format: date-time
 *                 description: Required unless frequency is NONE.
 *     responses:
 *       200:
 *         description: Cadence updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       400:
 *         description: nextMeetingDate is required when frequency is not NONE
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
// Recurring meeting cadence — drives the daily reminder job (checkMeetingReminders)
router.get("/:id/meeting-schedule", authorize("ADMIN", "MANAGER"), requirePermission("projects", "read"), getMeetingSchedule);
router.put("/:id/meeting-schedule", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), requirePermission("projects", "update"), validate(updateMeetingScheduleSchema), updateMeetingSchedule);

export default router;
