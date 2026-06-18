import { Router } from "express";
import * as freelancerController from "../controllers/freelancer.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createFreelancerProfileSchema,
  updateFreelancerProfileSchema,
  createMissionSchema,
  updateMissionSchema,
  updateApplicationStatusSchema,
} from "../validators/freelancer.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";

const router = Router();

/**
 * @swagger
 * /freelancers:
 *   get:
 *     summary: List public freelancer profiles
 *     tags: [Freelancers]
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
 *           default: 12
 *       - name: orderBy
 *         in: query
 *         schema:
 *           type: string
 *           enum: [name, email, hourlyRate, createdAt]
 *       - name: orderDir
 *         in: query
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: List of freelancers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FreelancerProfile'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 */

/**
 * @swagger
 * /freelancers/{id}:
 *   get:
 *     summary: Get freelancer profile details
 *     tags: [Freelancers]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Freelancer profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/FreelancerProfile'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

// Mission routes (before /:id to avoid route conflict)
/**
 * @swagger
 * /freelancers/missions:
 *   get:
 *     summary: List missions
 *     tags: [Freelancers]
 *     security:
 *       - bearerAuth: []
 *     description: FREELANCER sees open missions, ADMIN/CLIENT sees company missions
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
 *         description: List of missions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FreelancerMission'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/missions", authenticate, freelancerController.getMissions);

/**
 * @swagger
 * /freelancers/missions/{id}/applications:
 *   get:
 *     summary: Get mission applications
 *     tags: [Freelancers]
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
 *       200:
 *         description: List of applications
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  "/missions/:id/applications",
  authenticate,
  authorize("ADMIN", "CLIENT"),
  freelancerController.getMissionApplications
);

/**
 * @swagger
 * /freelancers/missions/{id}/applications/{applicationId}:
 *   patch:
 *     summary: Update application status (ACCEPT/REJECT)
 *     tags: [Freelancers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: applicationId
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACCEPTED, REJECTED]
 *     responses:
 *       200:
 *         description: Application status updated
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch(
  "/missions/:id/applications/:applicationId",
  authenticate,
  authorize("ADMIN", "CLIENT"),
  validate(updateApplicationStatusSchema),
  freelancerController.updateApplicationStatus
);

/**
 * @swagger
 * /freelancers/missions:
 *   post:
 *     summary: Create new mission
 *     tags: [Freelancers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               budget:
 *                 type: number
 *                 format: decimal
 *           example:
 *             title: Build REST API
 *             description: Full-stack REST API development
 *             budget: 5000
 *     responses:
 *       201:
 *         description: Mission created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/FreelancerMission'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  "/missions",
  authenticate,
  authorize("ADMIN", "CLIENT"),
  validate(createMissionSchema),
  freelancerController.createMission
);

/**
 * @swagger
 * /freelancers/missions/{id}:
 *   put:
 *     summary: Update mission
 *     tags: [Freelancers]
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               budget:
 *                 type: number
 *                 format: decimal
 *               status:
 *                 type: string
 *                 enum: [OPEN, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED]
 *     responses:
 *       200:
 *         description: Mission updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/FreelancerMission'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put(
  "/missions/:id",
  authenticate,
  authorize("ADMIN", "CLIENT"),
  validate(updateMissionSchema),
  freelancerController.updateMission
);

/**
 * @swagger
 * /freelancers/missions/{id}/apply:
 *   post:
 *     summary: Apply to mission
 *     tags: [Freelancers]
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
 *       201:
 *         description: Application submitted
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  "/missions/:id/apply",
  authenticate,
  authorize("FREELANCER"),
  freelancerController.applyToMission
);

/**
 * @swagger
 * /freelancers/missions/{id}:
 *   delete:
 *     summary: Delete mission
 *     tags: [Freelancers]
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
 *         description: Mission deleted
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete(
  "/missions/:id",
  authenticate,
  authorize("ADMIN", "CLIENT"),
  freelancerController.deleteMission
);

/**
 * @swagger
 * /freelancers/me:
 *   post:
 *     summary: Create my freelancer profile
 *     tags: [Freelancers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bio:
 *                 type: string
 *               hourlyRate:
 *                 type: number
 *                 format: decimal
 *               skillIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *           example:
 *             bio: Full-stack developer with 5 years experience
 *             hourlyRate: 75
 *             skillIds: [skill-id-1, skill-id-2]
 *     responses:
 *       201:
 *         description: Profile created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/FreelancerProfile'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  "/me",
  authenticate,
  authorize("FREELANCER"),
  validate(createFreelancerProfileSchema),
  freelancerController.createMyProfile
);

/**
 * @swagger
 * /freelancers/me:
 *   put:
 *     summary: Update my freelancer profile
 *     tags: [Freelancers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bio:
 *                 type: string
 *               hourlyRate:
 *                 type: number
 *                 format: decimal
 *               availability:
 *                 type: boolean
 *               skillIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/FreelancerProfile'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put(
  "/me",
  authenticate,
  authorize("FREELANCER"),
  validate(updateFreelancerProfileSchema),
  freelancerController.updateMyProfile
);

/**
 * @swagger
 * /freelancers/me:
 *   delete:
 *     summary: Delete my freelancer profile
 *     tags: [Freelancers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Profile deleted
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete(
  "/me",
  authenticate,
  authorize("FREELANCER"),
  freelancerController.deleteMyProfile
);

export default router;
