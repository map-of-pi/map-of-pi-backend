import Notification from "../models/Notification";
import { INotification } from "../types";
import logger from "../config/loggingConfig";

export const addNotification = async (pi_uid: string, reason: string): Promise<INotification> => {
  try {
    const notification = await Notification.create({pi_uid, reason, is_cleared: false});
    return notification as INotification;
  } catch (error: any) {
    logger.error(`Failed to add notification for piUID ${ pi_uid }: ${ error.message}`);
    throw error;
  }
};

export const getNotifications = async (
  pi_uid: string, 
  skip: number, 
  limit: number,
  status?: 'cleared' | 'uncleared'
): Promise<INotification[]> => {
  try {
    const filter: any = { pi_uid };

    if (status === 'cleared') {
      filter.is_cleared = true;
    } else if (status === 'uncleared') {
      filter.is_cleared = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return notifications as INotification[];
  } catch (error: any) {
    logger.error(`Failed to get notifications for piUID ${ pi_uid }: ${error.message}`);
    throw error;
  }
};

export const toggleNotificationStatus = async (notification_id: string): Promise<INotification | null> => {
  try {
    const notification = await Notification.findById(notification_id).exec();

    if (!notification) {
      return null;
    }

    const updatedNotification = await Notification.findByIdAndUpdate(
      { _id: notification_id },
      { is_cleared: !notification.is_cleared },
      { new: true }
    ).exec();

    return updatedNotification as INotification;
  } catch (error: any) {
    logger.error(`Failed to toggle notification status for ID ${ notification_id }: ${error.message}`);
    throw error;
  }
};

export const countNotifications = async ({
  pi_uid,
  status,
}: {
  pi_uid: string;
  status?: 'cleared' | 'uncleared';
}): Promise<number> => {
  try {
    const query: any = { pi_uid };

    if (status === 'cleared') query.is_cleared = true;
    if (status === 'uncleared') query.is_cleared = false;

    const count = await Notification.countDocuments(query);
    return count;
  } catch (error: any) {
    logger.error(`Failed to count notifications for piUID ${pi_uid}: ${error.message}`);
    throw error;
  }
};