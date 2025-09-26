import { Request, Response } from "express";
import * as notificationService from '../services/notification.service';
import logger from "../config/loggingConfig";

export const getNotifications = async (req: Request, res: Response) => {
  const authUser = req.currentUser;
  if (!authUser) {
    logger.warn('No authenticated user found when trying to get notifications.');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Pagination with expected defaults (1–100)
    const skip = Math.max(0, Math.floor(Number(req.query.skip) || 0));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 20)));

    // Validate status filter
    const status = ['cleared', 'uncleared'].includes(req.query.status as string)
      ? (req.query.status as 'cleared' | 'uncleared')
      : undefined;

    const { items, count } = await notificationService.getNotificationsAndCount(
      authUser.pi_uid,
      skip,
      limit,
      status
    );
    return res.status(200).json({ items, count });
  } catch (error) {
    logger.error(`Failed to get notifications for piUID ${authUser.pi_uid}`, error);
    return res.status(500).json({
      message: 'An error occurred while getting notifications; please try again later'
    });
  }
};

export const createNotification = async (req: Request, res: Response) => {
  const authUser = req.currentUser;

  // Check if authUser is defined
  if (!authUser) {
    logger.warn('No authenticated user found when trying to create notification.');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { reason } = req.body;
  try {
    const notification = await notificationService.addNotification(authUser?.pi_uid, reason);
    return res.status(200).json({ message: "Notification created successfully", notification });
  } catch (error) {
    logger.error('Failed to create notification', error);
    return res.status(500).json({ message: 'An error occurred while creating notification; please try again later' });
  }
};

export const updateNotification = async (req: Request, res: Response) => {
  const { notification_id } = req.params;
  try {
    const updatedNotification = await notificationService.toggleNotificationStatus(notification_id);
    if (!updatedNotification) {
      return res.status(404).json({ message: "Notification not found or could not be updated" });
    }
    logger.info("Notification updated:", updatedNotification);
    return res.status(200).json({ message: "Notification updated successfully", updatedNotification: updatedNotification });
  } catch (error) {
    logger.error('Failed to update notification', error);
    return res.status(500).json({ message: 'An error occurred while updating notification; please try again later' });
  }
};