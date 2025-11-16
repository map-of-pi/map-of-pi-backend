import { NextFunction, Request, Response } from "express";
import Membership from "../models/Membership";
import { IMembership } from "../types";
import logger from '../config/loggingConfig';

declare module 'express-serve-static-core' {
  interface Request {
    currentMembership: IMembership;
  }
}

export const isMembershipFound = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const membership_id = req.currentUser?.pi_uid;

  try {
    logger.info(`Checking if membership exists for user ID: ${membership_id}`);
    const currentMembership: IMembership | null = await Membership.findOne({pi_uid: membership_id});

    if (currentMembership) {
      req.currentMembership = currentMembership;
      logger.info(`Membership found: ${currentMembership._id}`);
      return next();
    } else {
      logger.warn(`Membership not found for user ID: ${membership_id}`);
      return res.status(404).json({message: "Membership not found"});
    }
  } catch (error) {
    logger.error('Failed to identify membership:', error);
    res.status(500).json({ message: 'Failed to identify | membership not found; please try again later'});
  }
};