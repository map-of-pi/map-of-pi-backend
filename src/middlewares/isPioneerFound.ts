import { NextFunction, Request, Response } from "express";

import { platformAPIClient } from "../config/platformAPIclient";
import logger from '../config/loggingConfig';

export const isPioneerFound = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader && authHeader.split(" ")[1];

    try {
      // Verify the user's access token with the /me endpoint:
      const me = await platformAPIClient.get(`/v2/me`, { 
        headers: { 'Authorization': `Bearer ${ tokenFromHeader }` }  
      });
      
      if (me && me.data) {
        const user = {
          pi_uid: me.data.uid,
          pi_username: me.data.username,
          user_name: me.data.username
        }
        req.body.user = user;
        logger.info(`Pioneer found: ${user.pi_uid} - ${user.pi_username}`);
        return next();
      } else {
        logger.warn("Pioneer not found.");
        return res.status(404).json({message: "Pioneer not found"});
      }
    } catch (error) {
      logger.error('Failed to identify pioneer:', error);
      res.status(500).json({ message: 'Failed to identify | pioneer not found; please try again later'});
    }
  };
  