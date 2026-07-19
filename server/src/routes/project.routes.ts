import { Router } from "express";
import { getAllProjects, getProjectById, createProject, updateProject, deleteProject, archiveProject, getDeletedProjects, restoreProject, getMyProjects, getTimelineStatus, getCompletedTasks, getBrief, submitBrief, clientApproveProject, receiveAiSpecs } from "../controllers/project.controller.js";
import { getHealthBoard } from "../controllers/healthBoard.controller.js";
import { createTimeEntry, listTimeEntries, getTimeSummary, getMyTimeSummary } from "../controllers/timeEntry.controller.js";
import { listProjectMeetings, createProjectMeeting, updateProjectMeeting, deleteProjectMeeting, getMeetingSchedule, updateMeetingSchedule } from "../controllers/projectMeeting.controller.js";
import { createProjectMeetingSchema, updateProjectMeetingSchema, deleteProjectMeetingSchema, updateMeetingScheduleSchema } from "../validators/projectMeeting.validator.js";
import { applyTemplateToProject } from "../controllers/projectTemplate.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createProjectSchema, updateProjectSchema } from "../validators/project.validator.js";
import { createTimeEntrySchema } from "../validators/timeEntry.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission, requireActivatedPortal } from "../middlewares/rbac.middleware.js";
import { verifyN8nWebhook } from "../middlewares/verifyN8nWebhook.middleware.js";
const router = Router();

router.get("/health-board", authenticate, authorize("ADMIN", "MANAGER"), requirePermission("projects", "read"), getHealthBoard);
// Ongoing project visibility is the cadrage's "Exécution & suivi" step, which comes after
// the deposit is paid — gated.
router.get("/my", authenticate, authorize("CLIENT"), requireActivatedPortal, getMyProjects);
router.get("/trash", authenticate, authorize("ADMIN", "MANAGER"), requirePermission("projects", "read"), getDeletedProjects);

// Timeline : accessible to CLIENT (own project only), MANAGER (own pole only), FREELANCER (own
// task only), ADMIN — not gated (payment activation), each scoped inside the service. authorize
// added explicitly (SEC, session 2026-07-18) as a router-level safety net, not the sole guard —
// a future added role or a service scoping mistake would otherwise fall through silently.
router.get("/:id/timeline-status", authenticate, authorize("ADMIN", "MANAGER", "CLIENT", "FREELANCER"), getTimelineStatus);

// SEC-061 : vue CLIENT simplifiée (titre + date) des tâches terminées, distincte de la timeline
// synthétique ci-dessus — CLIENT seul, mêmes conditions de visibilité que "/my" (portail continu,
// pas gated par requireActivatedPortal, cohérent avec la timeline déjà non gated).
router.get("/:id/completed-tasks", authenticate, authorize("CLIENT"), getCompletedTasks);

// Brief questionnaire : CLIENT submits, MANAGER (own pole)/ADMIN/FREELANCER (own task, redacted)
// read. Submitting the brief is the cadrage's "2e réunion de cadrage" step, which happens after
// the deposit is paid — gated. authorize added explicitly (SEC, session 2026-07-18), see above.
router.get("/:id/brief", authenticate, authorize("ADMIN", "MANAGER", "CLIENT", "FREELANCER"), getBrief);
router.post("/:id/brief/submit", authenticate, authorize("CLIENT"), requireActivatedPortal, submitBrief);

// Called back by the n8n brief-to-specs workflow — gated by HMAC signature, not a Secritou session.
router.patch("/:id/ai-specs", verifyN8nWebhook, receiveAiSpecs);

// Client final approval : triggers project COMPLETED + balance invoice — deep in execution,
// necessarily after the deposit is paid.
router.post("/:id/client-approve", authenticate, authorize("CLIENT"), requireActivatedPortal, clientApproveProject);

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
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       description: { type: string }
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
 *     responses:
 *       201:
 *         description: Project created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Proposal not found
 *       422:
 *         description: PROPOSAL_NOT_ACCEPTED — the referenced proposal is not in ACCEPTED status
 */
router.post("/", validate(createProjectSchema), authorize("ADMIN", "MANAGER"), requirePermission("projects", "create"), createProject);

/**
 * @swagger
 * /projects/{id}:
 *   put:
 *     summary: Update project
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
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Project updated
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put("/:id", validate(updateProjectSchema), authorize("ADMIN", "MANAGER"), requirePermission("projects", "update"), updateProject);

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
// ADMIN-only (unlike task deletion, which also allows MANAGER): deleting/archiving/restoring
// a project is a higher-impact action that cascades to all of its tasks and is gated by
// invoice/onboarding checks in project.service.ts — kept consistent with archive/restore
// below rather than opened up to MANAGER.
router.delete("/:id", authorize("ADMIN"), deleteProject);
router.post("/:id/archive", authorize("ADMIN"), archiveProject);
router.post("/:id/restore", authorize("ADMIN"), restoreProject);

// Time tracking
router.post("/:id/time-entries", authorize("ADMIN", "MANAGER", "FREELANCER"), validate(createTimeEntrySchema), createTimeEntry);
router.get("/:id/time-entries", authorize("ADMIN", "MANAGER", "FREELANCER"), listTimeEntries);
router.get("/:id/time-summary", authorize("ADMIN"), getTimeSummary);
router.get("/:id/my-time-summary", authorize("ADMIN", "MANAGER", "FREELANCER"), getMyTimeSummary);

// Templates — apply the project's pole template as a one-shot bulk task creation
router.post("/:id/apply-template", authorize("ADMIN", "MANAGER"), requirePermission("projects", "update"), applyTemplateToProject);

// Meetings — lightweight log, ADMIN/MANAGER only (no client/freelancer visibility). Update/delete
// (SEC-055/F6) additionally require, at the service layer, that the actor is the meeting's own
// author or ADMIN — requirePermission("projects", "update") alone would let any MANAGER of the
// project's pole edit a colleague's meeting note.
router.get("/:id/meetings", authorize("ADMIN", "MANAGER"), requirePermission("projects", "read"), listProjectMeetings);
router.post("/:id/meetings", authorize("ADMIN", "MANAGER"), requirePermission("projects", "update"), validate(createProjectMeetingSchema), createProjectMeeting);
router.put("/:id/meetings/:meetingId", authorize("ADMIN", "MANAGER"), requirePermission("projects", "update"), validate(updateProjectMeetingSchema), updateProjectMeeting);
router.delete("/:id/meetings/:meetingId", authorize("ADMIN", "MANAGER"), requirePermission("projects", "update"), validate(deleteProjectMeetingSchema), deleteProjectMeeting);

// Recurring meeting cadence — drives the daily reminder job (checkMeetingReminders)
router.get("/:id/meeting-schedule", authorize("ADMIN", "MANAGER"), requirePermission("projects", "read"), getMeetingSchedule);
router.put("/:id/meeting-schedule", authorize("ADMIN", "MANAGER"), requirePermission("projects", "update"), validate(updateMeetingScheduleSchema), updateMeetingSchedule);

export default router;
