import logger from "../config/loggingConfig";
import { ISellerItem } from "../types";

export const isExpiredItem = (item: ISellerItem): boolean => {
  if (!item || !item.expired_by) return true;
  return new Date() > new Date(item.expired_by);
};

export const getRemainingWeeks = (existing_item: ISellerItem): number => {
  if (!existing_item || !existing_item.expired_by || !existing_item.duration) return 0;

  const now = new Date();
  const expiry = new Date(existing_item.expired_by);

  // Calculate total weeks from duration
  const totalWeeks = Math.floor(Number(existing_item.duration));

  // Calculate weeks left (excluding current week)
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const msLeft = expiry.getTime() - now.getTime();
  const weeksLeft = Math.floor(msLeft / msPerWeek);

  // Exclude current week
  const remainingWeeks = Math.max(weeksLeft - 1, 0);

  // Ensure not more than total duration
  return Math.min(remainingWeeks, totalWeeks);
};

export const getChangeInWeeks = (existingItem: ISellerItem, itemData: ISellerItem): number => {
  const newDuration = Math.max(Number(itemData.duration) || 1, 1);
  const existingDuration = Math.max(Number(existingItem.duration) || 1, 1);

  const change = newDuration - existingDuration;

  if (change < 0) {
    const remainingWeeks = getRemainingWeeks(existingItem);
    if (Math.abs(change) > remainingWeeks) {
      logger.warn(`Attempted to reduce duration by ${ Math.abs(change) } weeks, but only ${ remainingWeeks } weeks remain.`);
      return 0; // Prevent reducing more than remaining weeks
    }
  }

  return change;
};

export const computeNewExpiryDate = (existingItem: ISellerItem, itemData: ISellerItem): Date => {
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  if (isExpiredItem(existingItem)) {
    // Reset to new duration from now
    const newDuration = Math.max(Number(itemData.duration) || 1, 1);
    return new Date(now.getTime() + newDuration * msPerWeek);
  }

  const expiry = new Date(existingItem.expired_by);
  const changeInWeeks = getChangeInWeeks(existingItem, itemData);

  // If duration increased, extend expiry
  if (changeInWeeks > 0) {
    return new Date(expiry.getTime() + changeInWeeks * msPerWeek);
  }

  // If duration decreased, reduce expiry
  if (changeInWeeks < 0) {
    return new Date(expiry.getTime() + changeInWeeks * msPerWeek);
  }

  // No change;
    return expiry;
};