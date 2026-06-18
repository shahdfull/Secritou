import { Router } from "express";
import * as ratingController from "../controllers/rating.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createRatingSchema,
  updateRatingSchema,
} from "../validators/rating.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";

const router = Router();

/**
 * @swagger
 * /ratings/freelancers/{freelancerId}:
 *   get:
 *     summary: List freelancer ratings and reviews
 *     tags: [Ratings]
 *     parameters:
 *       - name: freelancerId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Freelancer ratings and statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           score:
 *                             type: integer
 *                             minimum: 1
 *                             maximum: 5
 *                           comment:
 *                             type: string
 *                           reviewer:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     stats:
 *                       type: object
 *                       properties:
 *                         averageScore:
 *                           type: number
 *                           format: decimal
 *                           minimum: 0
 *                           maximum: 5
 *                         reviewCount:
 *                           type: integer
 *                         distribution:
 *                           type: object
 *                           properties:
 *                             "1":
 *                               type: integer
 *                             "2":
 *                               type: integer
 *                             "3":
 *                               type: integer
 *                             "4":
 *                               type: integer
 *                             "5":
 *                               type: integer
 */
router.get("/freelancers/:freelancerId", ratingController.getFreelancerRatings);

/**
 * @swagger
 * /ratings/freelancers/{freelancerId}/stats:
 *   get:
 *     summary: Get freelancer rating statistics
 *     tags: [Ratings]
 *     parameters:
 *       - name: freelancerId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Rating statistics
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/freelancers/:freelancerId/stats", ratingController.getFreelancerRatingStats);

/**
 * @swagger
 * /ratings/{id}:
 *   get:
 *     summary: Get rating by ID
 *     tags: [Ratings]
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
 *         description: Rating details
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", authenticate, ratingController.getRatingById);

/**
 * @swagger
 * /ratings:
 *   post:
 *     summary: Create rating for freelancer
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Only CLIENT role can rate freelancers. Requirements:
 *       - Mission must be COMPLETED
 *       - Freelancer must have ACCEPTED application on that mission
 *       - One rating per mission per freelancer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [freelancerId, missionId, score]
 *             properties:
 *               freelancerId:
 *                 type: string
 *                 format: uuid
 *               missionId:
 *                 type: string
 *                 format: uuid
 *               score:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *                 maxLength: 2000
 *           example:
 *             freelancerId: f47ac10b-58cc-4372-a567-0e02b2c3d479
 *             missionId: 6ba7b810-9dad-11d1-80b4-00c04fd430c8
 *             score: 5
 *             comment: Excellent work, delivered on time!
 *     responses:
 *       201:
 *         description: Rating created
 *       400:
 *         description: Invalid input (mission not completed, already rated, etc.)
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Conflict (rating already exists for this mission)
 */
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "CLIENT"),
  validate(createRatingSchema),
  ratingController.createRating
);

/**
 * @swagger
 * /ratings/{id}:
 *   patch:
 *     summary: Update rating
 *     tags: [Ratings]
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
 *               score:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       200:
 *         description: Rating updated
 *       403:
 *         description: Can only edit your own ratings
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "CLIENT"),
  validate(updateRatingSchema),
  ratingController.updateRating
);

/**
 * @swagger
 * /ratings/{id}:
 *   delete:
 *     summary: Delete rating
 *     tags: [Ratings]
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
 *         description: Rating deleted
 *       403:
 *         description: Can only delete your own ratings
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN", "CLIENT"),
  ratingController.deleteRating
);

export default router;
