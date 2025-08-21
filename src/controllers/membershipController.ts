import { Request, Response } from "express";
import * as membershipService from "../services/membership.service";
import { IUser } from "../types"
import logger from "../config/loggingConfig";

export const getMembershipList = async (req: Request, res: Response) => {
  try {
    const membershipList = await membershipService.buildMembershipList();
    if (!membershipList || membershipList.length === 0) {
      logger.warn(`No membership list found`);
      return res.status(404).json({ message: "Membership list not found" });
    }
    logger.info(`Fetched membership list`);
    return res.status(200).json(membershipList);
  } catch (error) {
    logger.error(`Error getting membership list: `, error);
    return res.status(500).json({ message: 'An error occurred while getting membership list; please try again later' });
  }
}; 

export const getSingleMembership = async (req: Request, res: Response) => {
  const { membership_id } = req.params;
  try {
    const membership = await membershipService.getSingleMembershipById(membership_id);
    if (!membership) {
      logger.warn(`Membership with ID ${membership_id} not found.`);
      return res.status(404).json({ message: "Membership not found" });
    }
    logger.info(`Fetched membership with ID ${membership_id}`);
    return res.status(200).json(membership);
  } catch (error) {
    logger.error(`Error getting membership ID ${membership_id}:`, error);
    return res.status(500).json({ message: 'An error occurred while getting single membership; please try again later' });
  }
};

export const fetchUserMembership = async (req: Request, res: Response) => {
  const authUser = req.currentUser as IUser;
  try {
    const currentMembership = await membershipService.getUserMembership(authUser);
    if (!currentMembership) {
      logger.warn(`User Membership with ID ${authUser.pi_uid} not found.`);
      return res.status(404).json({ message: "User Membership not found" });
    }
    logger.info(`Fetched user membership with ID ${authUser.pi_uid}`);
    return res.status(200).json(currentMembership);
  } catch (error) {
    logger.error(`Failed to fetch user membership with ID ${authUser.pi_uid}:`, error);
    return res.status(500).json({ message: 'An error occurred while fetching user membership; please try again later' });
  }
};

export const updateMembership = async (req: Request, res: Response) => { 
  try {
    const { membership_class } = req.body;
    const authUser = req.currentUser;
    if (!authUser) {
      logger.warn('No authenticated user found when updating/ renewing membership.');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    logger.info(`Updated or renewed membership for user ${authUser.pi_uid}`);
    const updatedMembership = await membershipService.applyMembershipChange(authUser.pi_uid, membership_class);
    return res.status(200).json(updatedMembership);
  } catch (error: any) {
    logger.error("Failed to update or renew membership:", error);
    return res.status(500).json({ message: 'An error occurred while updating membership; please try again later' });
  }
};