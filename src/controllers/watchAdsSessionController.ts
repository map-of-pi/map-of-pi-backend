  import { Request, Response } from "express";
import { WATCH_ADS_SESSION_STATUS } from "../models/enums/watchAds";
import * as WatchAdsSessionService from "../services/watchAdsSession.service";
import logger from "../config/loggingConfig";
import { IUser } from "../types";


// POST /api/v1/watch-ads/session
export const startWatchAdsSession = async (req: Request, res: Response) => {
  const authUser = req.currentUser as IUser;
  if (!authUser) {
    logger.warn("No authenticated user found when trying to start watch-ads session.");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Step 1: Check if user already has an active session
    const activeSession = await WatchAdsSessionService.findActiveSession(authUser._id);
    if (activeSession) {
      return res.json(activeSession);
    }

    // Step 2: Create a new session
    const newSession = await WatchAdsSessionService.createSession(authUser._id, {
      status: WATCH_ADS_SESSION_STATUS.Running,
      totalSegments: 20,
      segmentSecs: 30,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // SESSION_TTL = 24h
    });

    return res.status(201).json(newSession);

  } catch (err: any) {
    // Handle race condition where another request created it just now
    if (err.code === 11000) { 
      logger.warn(`Race detected: active WatchAdsSession already exists for user ${authUser._id}`);
      const existingSession = await WatchAdsSessionService.findActiveSession(authUser._id);
      if (existingSession) return res.json(existingSession);
    }

    logger.error("Error starting watch-ads session", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// POST /api/v1/watch-ads/session/:id/segment-complete
export const completeSegment = async (req: Request, res: Response) => {
  const authUser = req.currentUser as IUser;
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { id } = req.params;
    const { adId } = req.body;

    const updated = await WatchAdsSessionService.completeSegment(authUser._id, id, adId);
    if (!updated) {
      return res.status(404).json({ error: "Session not found or expired" });
    }

    return res.json(updated);
  } catch (err: any) {
    logger.error("Error completing watch-ads segment", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
