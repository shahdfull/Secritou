import { Router } from "express";
import * as clientController from "../controllers/client.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createClientSchema, updateClientSchema } from "../validators/client.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import { requireCompanyTenant } from "../middlewares/tenant.middleware.js";

const router = Router();
router.use(authenticate);
router.use(authorize("ADMIN"));
router.use(requireCompanyTenant());

router.get("/", clientController.getClients);
router.get("/:id", clientController.getClient);
router.post("/", validate(createClientSchema), clientController.createClient);
router.put("/:id", authorize("ADMIN"), validate(updateClientSchema), clientController.updateClient);
router.delete("/:id", authorize("ADMIN"), clientController.deleteClient);

export default router;
