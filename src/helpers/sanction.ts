import { SanctionedUpdateResult } from "../types";

interface SanctionedStats {
  total: number;
  changed: number;
  restricted: number;
  unrestricted: number;
}

export const summarizeSanctionedResults = (
  results: PromiseSettledResult<SanctionedUpdateResult>[]
): SanctionedStats => {
  const stats: SanctionedStats = {
    total: results.length,
    changed: 0,
    restricted: 0,
    unrestricted: 0
  };

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const r = result.value;
      if (r.isChanged) stats.changed++;
      if (r.isRestricted) {
        stats.restricted++;
      } else {
        stats.unrestricted++;
      }
    }
  }

  return stats;
};

/* In-memory caching layer with time-based expiration (TTL) */
const timeToLive = 60 * 60 * 1000; // 1 hour TTL
let cache: any = null;
let expiry: number = 0;

export const getCachedSanctionedBoundaries = async (fetchFn: any) => {
  const now = Date.now();
  if (cache && expiry && now < expiry) {
    return cache;
  }

  const result = await fetchFn();
  cache = result;
  expiry = now + timeToLive;
  return result;
};
