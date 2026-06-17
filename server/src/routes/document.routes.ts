import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/rbac.middleware.js';
import { requireCompanyTenant } from '../middlewares/tenant.middleware.js';
import * as documentController from '../controllers/document.controller.js';

const router = Router();

router.get('/client/:clientId', authenticate, requireCompanyTenant(), authorize('ADMIN'), documentController.getClientDocuments);
router.post('/', authenticate, requireCompanyTenant(), authorize('ADMIN'), documentController.createDocument);

export default router;
