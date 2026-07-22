import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { addRatingSchema } from "../validators/rating.validator.js";
import * as ratingController from "../controllers/rating.controller.js";
import { sensitiveWriteRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.get("/freelancers/:freelancerId", authenticate, authorize("ADMIN", "MANAGER", "FREELANCER"), ratingController.getRatings);
router.post("/freelancers/:freelancerId", authenticate, sensitiveWriteRateLimit, authorize("ADMIN", "MANAGER"), validate(addRatingSchema), ratingController.addRating);

export default router;
