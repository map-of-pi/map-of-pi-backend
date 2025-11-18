import { Types } from 'mongoose';
import { WatchAdsSession } from '../models/WatchAdsSession';
import { WATCH_ADS_SESSION_STATUS } from '../models/enums/watchAds';
import { WatchAdsBalance } from '../models/WatchAdsBalance';

type CreateOpts = {
  status?: string;          // should be WATCH_ADS_SESSION_STATUS.Running
  totalSegments?: number;   // default 20
  segmentSecs?: number;     // default 30
  expiresAt?: Date;         // default now + 24h
};

export async function findActiveSession(userId: Types.ObjectId) {
  const now = new Date();
  await WatchAdsSession.updateMany(
    { userId, status: WATCH_ADS_SESSION_STATUS.Running, expiresAt: { $lte: now } },
    { $set: { status: WATCH_ADS_SESSION_STATUS.Expired, endedAt: now } }
  );
  return WatchAdsSession.findOne({
    userId, status: WATCH_ADS_SESSION_STATUS.Running, expiresAt: { $gt: now }
  }).lean();
}

export async function createSession(userId: Types.ObjectId, opts: CreateOpts = {}) {
  const nowMs = Date.now();
  const now = new Date(nowMs);

  const {
  status = WATCH_ADS_SESSION_STATUS.Running,
  totalSegments = opts.totalSegments ?? 20,
  segmentSecs = opts.segmentSecs ?? 30,
  expiresAt = opts.expiresAt ?? new Date(nowMs + 24 * 60 * 60 * 1000),
} = opts;

  // Validation
  if (totalSegments <= 0 || segmentSecs <= 0) {
    throw new Error("Invalid session parameters: totalSegments and segmentSecs must be greater than 0");
  }

  // 1. Expire any stale running sessions *before* we do anything else
  await WatchAdsSession.updateMany(
    { userId, status: WATCH_ADS_SESSION_STATUS.Running, expiresAt: { $lte: now } },
    { $set: { status: WATCH_ADS_SESSION_STATUS.Expired, endedAt: now } }
  );

  let attempt = 0;
  while (attempt < 3) {
    try {
      const doc = await WatchAdsSession.create({
        userId,
        status,
        totalSegments,
        segmentSecs,
        completedSegments: 0,
        earnedSecs: 0,
        startedAt: now,
        expiresAt,
      });
      return doc.toObject();
    } catch (err: any) {
      if (err?.code === 11000) {
        // Another session got created in the meantime — return it if valid
        const active = await WatchAdsSession.findOne({
          userId,
          status: WATCH_ADS_SESSION_STATUS.Running,
          expiresAt: { $gt: new Date() },
        }).lean();
        if (active) return active;

        // Otherwise, loop and try creating again
        attempt++;
        continue;
      }
      throw err;
    }
  }

  // If we hit repeated collisions — just return the active one if any
  return WatchAdsSession.findOne({
    userId,
    status: WATCH_ADS_SESSION_STATUS.Running,
    expiresAt: { $gt: new Date() },
  }).lean();
}

export async function completeSegment(userId: Types.ObjectId, sessionId: string, adId: string) {
  // 1. Find active session
  const session = await WatchAdsSession.findOne({
    _id: sessionId,
    userId,
    status: WATCH_ADS_SESSION_STATUS.Running,
  });
  if (!session) return null;

  // 2. Increment session progress
  session.completedSegments += 1;
  session.earnedSecs += session.segmentSecs;

  if (session.completedSegments >= session.totalSegments) {
    session.status = WATCH_ADS_SESSION_STATUS.Completed;
    session.endedAt = new Date();
  }

  await session.save();

  // 3. Increment or create balance
  await WatchAdsBalance.findOneAndUpdate(
    { userId },
    {
      $inc: {
        availableSecs: session.segmentSecs,
        lifetimeEarnedSecs: session.segmentSecs,
      },
    },
    { upsert: true, new: true }
  );

  // 4. Return updated session
  return session.toObject();
}
