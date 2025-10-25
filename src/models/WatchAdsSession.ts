import { Schema, model } from 'mongoose';
import type { IWatchAdsSession } from '../types';
import { WATCH_ADS_SESSION_STATUS } from '../models/enums/watchAds';

const WatchAdsSessionSchema = new Schema<IWatchAdsSession>(
  {
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
    },
    status: {
      type: String,
      enum: Object.values(WATCH_ADS_SESSION_STATUS),
      default: WATCH_ADS_SESSION_STATUS.Running,
      index: true,
    },
    totalSegments: { type: Number, required: true, min: 1, default: 20 },
    segmentSecs: { type: Number, required: true, min: 1, default: 30 },
    completedSegments: { type: Number, default: 0, min: 0 },
    earnedSecs: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date, default: () => new Date() },
    endedAt: { type: Date },
    expiresAt: { 
      type: Date, 
      required: true, 
      index: { expireAfterSeconds: 0 } // MongoDB TTL cleanup
    },
  },
  { timestamps: true }
);

// Enforce: only one running session per user
WatchAdsSessionSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: WATCH_ADS_SESSION_STATUS.Running } }
);

export const WatchAdsSession = model<IWatchAdsSession>(
  'WatchAdsSession',
  WatchAdsSessionSchema
);
