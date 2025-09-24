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

export async function getNotificationsAndCount(
  pi_uid: string,
  skip: number,
  limit: number,
  status?: 'cleared' | 'uncleared'
): Promise<{ items: INotification[]; count: number }> {
  try {
    const filter: any = { pi_uid };
    if (status === 'cleared') filter.is_cleared = true;
    if (status === 'uncleared') filter.is_cleared = false;

    const [items, count] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      Notification.countDocuments(filter).exec()
    ]);

    return { items, count };
  } catch (error: any) {
    logger.error(`Failed to get notifications+count for piUID ${pi_uid}: ${error.message}`);
    throw error;
  }
}
