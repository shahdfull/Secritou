import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { translateSchema } from "../validators/translation.validator.js";
import { translateFrToEn } from "../controllers/translation.controller.js";

const router = Router();

// ADMIN only — this powers the "translate to English" helper in the site
// content editor, not a general-purpose translation API.
router.post("/fr-to-en", authenticate, authorize("ADMIN"), validate(translateSchema), translateFrToEn);

export default router;
