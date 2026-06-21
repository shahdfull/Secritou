import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as notificationController from '../controllers/notification.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { notificationIdParamSchema } from '../validators/notification.validator.js';

const router = Router();

router.get('/', authenticate, notificationController.getNotifications);
router.patch('/:id/read', authenticate, validate(notificationIdParamSchema), notificationController.markAsRead);
router.patch('/read-all', authenticate, notificationController.markAllAsRead);

export default router;
