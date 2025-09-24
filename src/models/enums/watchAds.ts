export const WATCH_ADS_SESSION_STATUS = {
  Running: 'running',
  Completed: 'completed',
  Expired: 'expired',
  Aborted: 'aborted',
} as const;

export type WatchAdsSessionStatus =
  typeof WATCH_ADS_SESSION_STATUS[keyof typeof WATCH_ADS_SESSION_STATUS];