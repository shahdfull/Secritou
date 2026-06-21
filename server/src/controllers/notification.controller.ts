import type { RequestHandler } from 'express';
import { notificationService } from '../services/notification.service.js';

export const getNotifications: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub as string;
    const notifications = await notificationService.getNotifications(userId);
    res.json({ data: notifications });
  } catch (error) {
    next(error);
  }
};

export const markAsRead: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub as string;
    const notification = await notificationService.markAsRead(req.params.id as string, userId);
    res.json({ data: notification });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.sub as string;
    await notificationService.markAllAsRead(userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};
