import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  getMe,
  updateMe,
  requestEmailChange,
  confirmEmailChange,
  getUsers,
  inviteUser,
  updateUser,
  deleteUser,
  getPermissions,
  heartbeat,
} from "../controllers/user.controller.js";
import { createUserSchema, updateUserSchema, updateMeSchema, requestEmailChangeSchema, confirmEmailChangeSchema } from "../validators/user.validator.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();

/**
 * @swagger
 * /users/me/email-change/confirm:
 *   post:
 *     summary: Confirm a pending email change via the token emailed to the new address
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email changed
 *       400:
 *         description: Invalid or expired token
 */
// Public (no `authenticate`), like /auth/reset-password: the token itself, sent only to the
// new address, is the proof of authorization — requiring a live session here would break the
// flow whenever the confirmation link is opened after the original session expired.
router.post("/me/email-change/confirm", validate(confirmEmailChangeSchema), confirmEmailChange);

router.use(authenticate);

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user details
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/me", getMe);

/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: Update current user details
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 50
 *                 description: Send null (not omitted) to clear a previously saved phone number.
 *           example:
 *             name: Jane Doe
 *             phone: "+21612345678"
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.patch("/me", validate(updateMeSchema), updateMe);

/**
 * @swagger
 * /users/me/email-change:
 *   post:
 *     summary: Request an email change — sends a confirmation link to the new address
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       202:
 *         description: Confirmation email sent
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Email already in use
 */
router.post("/me/email-change", sensitiveWriteRateLimit, validate(requestEmailChangeSchema), requestEmailChange);

/**
 * @swagger
 * /users/me/heartbeat:
 *   post:
 *     summary: Record a connected-time heartbeat for the current user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Heartbeat recorded
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post("/me/heartbeat", heartbeat);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List users (ADMIN/MANAGER only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: pageSize
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/User'
 *                       - type: object
 *                         properties:
 *                           connectedTimeAverages:
 *                             type: object
 *                             properties:
 *                               today:
 *                                 type: number
 *                               weekly:
 *                                 type: number
 *                               monthly:
 *                                 type: number
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pageSize:
 *                   type: integer
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", authorize("ADMIN", "MANAGER"), getUsers);

/**
 * @swagger
 * /users/permissions:
 *   get:
 *     summary: Get the permission matrix for all roles
 *     description: >
 *       Returns the full static permission matrix (all 4 roles), not just the permissions of
 *       the calling user — the caller is expected to look up its own role's entry client-side.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permission matrix, keyed by role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     ADMIN:
 *                       type: array
 *                       items:
 *                         type: string
 *                     MANAGER:
 *                       type: array
 *                       items:
 *                         type: string
 *                     FREELANCER:
 *                       type: array
 *                       items:
 *                         type: string
 *                     CLIENT:
 *                       type: array
 *                       items:
 *                         type: string
 *                   example:
 *                     ADMIN: [manage_users, manage_companies, manage_clients, manage_leads, manage_projects, manage_tasks, view_analytics, view_documents, view_settings]
 *                     MANAGER: [manage_projects, manage_tasks, view_clients, view_leads, view_analytics, view_documents]
 *                     FREELANCER: [view_projects, update_my_tasks, manage_my_profile]
 *                     CLIENT: [view_my_projects, view_my_service_requests, view_my_documents]
 */
router.get("/permissions", getPermissions);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Invite new user (ADMIN only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name, role]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, MANAGER, CLIENT, FREELANCER]
 *           example:
 *             email: newuser@example.com
 *             name: Jane Doe
 *             role: CLIENT
 *     responses:
 *       201:
 *         description: User invited
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post("/", authorize("ADMIN"), validate(createUserSchema), inviteUser);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update user (ADMIN only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [ADMIN, MANAGER, CLIENT, FREELANCER]
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch("/:id", authorize("ADMIN"), validate(updateUserSchema), updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user (ADMIN only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: User deleted
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", authorize("ADMIN"), deleteUser);

export default router;
