import { Router } from "express";
import * as clientController from "../controllers/client.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createClientSchema,
  updateClientSchema,
  deleteClientSchema,
  archiveClientSchema,
  inviteClientUserSchema,
} from "../validators/client.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize, requirePermission, requireActivatedPortal } from "../middlewares/rbac.middleware.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();
router.use(authenticate);
// Note: authorization is per-route. Reads are ADMIN + MANAGER (a MANAGER sees only clients
// with a project in their service, enforced in the service layer). Mutations are ADMIN only.

/**
 * @swagger
 * /clients:
 *   get:
 *     summary: List all clients
 *     tags: [Clients]
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
 *         description: List of clients
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Client'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pageSize:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", authorize("ADMIN", "MANAGER"), requirePermission("clients", "read"), clientController.getClients);

/**
 * @swagger
 * /clients/{id}:
 *   get:
 *     summary: Get client by ID
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Client details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Client'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Not gated by requireActivatedPortal: the frontend needs this to detect activation state
// itself (Client.portalActivatedAt is included in the response) and show a pending screen.
router.get("/my", authorize("CLIENT"), clientController.getMyClient);
router.get("/my/credit-notes", authorize("CLIENT"), requireActivatedPortal, clientController.getMyCreditNotes);
router.get("/trash", authorize("ADMIN", "MANAGER"), requirePermission("clients", "read"), clientController.getDeletedClients);
router.get("/:id", authorize("ADMIN", "MANAGER"), requirePermission("clients", "read"), clientController.getClient);
router.get("/:id/credit-notes", authorize("ADMIN", "MANAGER"), requirePermission("clients", "read"), clientController.getClientCreditNotes);

/**
 * @swagger
 * /clients:
 *   post:
 *     summary: Create a new client
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateClientRequest'
 *     responses:
 *       201:
 *         description: Client created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Client'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post("/", sensitiveWriteRateLimit, authorize("ADMIN"), validate(createClientSchema), clientController.createClient);

/**
 * @swagger
 * /clients/{id}:
 *   put:
 *     summary: Update client
 *     tags: [Clients]
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
 *             $ref: '#/components/schemas/UpdateClientRequest'
 *     responses:
 *       200:
 *         description: Client updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Client'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put("/:id", authorize("ADMIN"), validate(updateClientSchema), clientController.updateClient);

/**
 * @swagger
 * /clients/{id}:
 *   delete:
 *     summary: Delete client
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Client deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", sensitiveWriteRateLimit, authorize("ADMIN"), validate(deleteClientSchema), clientController.deleteClient);
router.post("/:id/restore", sensitiveWriteRateLimit, authorize("ADMIN"), validate(deleteClientSchema), clientController.restoreClient);

/**
 * @swagger
 * /clients/{id}/archive:
 *   post:
 *     summary: Archive client (preserves all linked records; hides from default lists)
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Client archived
 */
router.post("/:id/archive", sensitiveWriteRateLimit, authorize("ADMIN"), validate(archiveClientSchema), clientController.archiveClient);

router.post("/:id/invite", sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), requirePermission("clients", "update"), validate(inviteClientUserSchema), clientController.inviteClientUser);

export default router;
