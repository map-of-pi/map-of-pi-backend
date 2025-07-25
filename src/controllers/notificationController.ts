import { Request, Response } from "express";
import * as notificationService from '../services/notification.service';
import logger from "../config/loggingConfig";

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

export const getNotifications = async (req: Request, res: Response) => {
  const { pi_uid } = req.params;
  const skip = req.query.skip ? Number(req.query.skip) : 0;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  try {
    const notifications = await notificationService.getNotifications(pi_uid, skip, limit);
    return res.status(200).json(notifications);
  } catch (error) {
    logger.error('Failed to get notifications', error);
    return res.status(500).json({ message: 'An error occurred while getting notifications; please try again later' });
  }
};

export const getNotificationsCount = async (req: Request, res: Response) => {
  try {
    const authUser = req.currentUser;

    if (!authUser) {
        logger.warn('No authenticated user found when trying to get notification count.');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const status = req.query.status as 'cleared'| 'uncleared' | undefined;

      const count = await notificationService.countNotifications({
        pi_uid: authUser.pi_uid,
        status,
      });

      return res.status(200).json({ count });
    } catch (error) {
      logger.error('Failed to count notifications', error);
      return res.status(500).json({ message: 'An error occurred while counting notifications; please try again later' });
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