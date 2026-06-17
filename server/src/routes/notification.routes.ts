import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = Router();

router.get('/', authenticate, notificationController.getNotifications);
router.patch('/:id/read', authenticate, notificationController.markAsRead);
router.patch('/read-all', authenticate, notificationController.markAllAsRead);

export default router;
