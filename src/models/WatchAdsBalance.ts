import { Schema, model } from 'mongoose';
import { IWatchAdsBalance } from '../types';

const WatchAdsBalanceSchema = new Schema<IWatchAdsBalance>(
  { 
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      unique: true,
    },
    availableSecs: { type: Number, default: 0, min: 0 },
    lifetimeEarnedSecs: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

// Redundant with `unique: true` above, but fine to keep for clarity
WatchAdsBalanceSchema.index({ userId: 1 }, { unique: true });

export const WatchAdsBalance = model<IWatchAdsBalance>(
  'WatchAdsBalance',
  WatchAdsBalanceSchema
);
