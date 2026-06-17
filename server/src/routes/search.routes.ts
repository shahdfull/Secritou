import { Router } from "express";
import { globalSearch } from "../controllers/search.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";

const router = Router();

router.get("/", authenticate, authorize("ADMIN", "MANAGER"), globalSearch);

export default router;
