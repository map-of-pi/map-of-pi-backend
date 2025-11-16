import * as turf from '@turf/turf';

import { 
  getCachedSanctionedBoundaries, 
  summarizeSanctionedResults 
} from '../../helpers/sanction';
import Seller from '../../models/Seller';
import SanctionedGeoBoundary from '../../models/misc/SanctionedGeoBoundary';
import { addNotification } from '../../services/notification.service';
import { ISeller, SanctionedUpdateResult } from '../../types';
import logger from '../../config/loggingConfig';

/* Fetch raw sanctioned boundaries */
const getSanctionedGeoBoundaries = async () => {
  return SanctionedGeoBoundary.find({}, { geometry: 1 }).lean();
};

/* Compute bounding box of polygons */
const computeBoundingBox = (turfPolygons: any[]) => {
  const featureCollection = turf.featureCollection(turfPolygons);
  const [minX, minY, maxX, maxY] = turf.bbox(featureCollection);
  return { minX, minY, maxX, maxY };
};

/* Restriction update + notification */
export const updateAndNotify = async (
  seller: ISeller, 
  isNowRestricted: boolean
): Promise<SanctionedUpdateResult> => {

  // Skip if restriction status hasn't changed
  const isChanged = seller.isRestricted !== isNowRestricted;
  if (!isChanged) {
    return {
      seller_id: seller.seller_id.toString(),
      isChanged: false,
      isRestricted: isNowRestricted,
      isUpdateSuccess: false,
      isNotificationSuccess: false
    } as SanctionedUpdateResult;
  }

  let isUpdateSuccess = false;
  let isNotificationSuccess = false;
  
  try {
    await Seller.updateOne({ _id: seller._id }, {
      isRestricted: isNowRestricted,
      sanction_last_checked: new Date(),
    });
    isUpdateSuccess = true;
  } catch (error) {
    logger.error(`Failed to update seller ${seller.seller_id}: ${error}`);
  }

  if (isUpdateSuccess) {
    try {
      await addNotification(
        seller.seller_id,
        isNowRestricted
          ? 'Your Sell Center is in a Pi Network sanctioned area, so your map marker will no longer appear in searches.'
          : 'Your Sell Center is no longer in a Pi Network sanctioned area, so your map marker will now be visible in searches.',
      );
      isNotificationSuccess = true;
    } catch (error) {
      logger.error(`Failed to notify seller ${seller.seller_id}: ${error}`);
    }
  }

  return {
    seller_id: seller.seller_id.toString(),
    isChanged,
    isRestricted: isNowRestricted,
    isUpdateSuccess,
    isNotificationSuccess
  } as SanctionedUpdateResult;
};

/* Parse boundaries to turf polygons */
export const parseToValidTurfPolygons = (boundaries: any[]) => {
  const turfPolygons: any[] = [];

  const closeRingIfNeeded = (ring: number[][]): number[][] => {
    const [first, last] = [ring[0], ring[ring.length - 1]];
    return (first[0] !== last[0] || first[1] !== last[1]) ? [...ring, first] : ring;
  };

  const isValidRing = (ring: number[][]): boolean => ring.length >= 4;

  const processPolygon = (coordinates: number[][][]): void => {
    const rings = coordinates.map(closeRingIfNeeded);
    if (!isValidRing(rings[0])) {
      logger.warn('Skipping Polygon: too few coordinates');
      return;
    }
    turfPolygons.push(turf.polygon(rings));
  };

  for (const boundary of boundaries) {
    const { geometry } = boundary;
    try {
      if (geometry.type === 'Polygon') {
        processPolygon(geometry.coordinates);
      } else if (geometry.type === 'MultiPolygon') {
        for (const coords of geometry.coordinates) {
          processPolygon(coords);
        }
      } else {
        logger.warn('Skipping Polygon/ MultiPolygon: unknown geometry type:', geometry.type);
      }
    } catch (error: any) {
      logger.error(`Failed to parse polygon: ${error.message}`, boundary._id?.toString());
    }
  }

  return turfPolygons;
};

export const findAndRestrictSanctionedSellers = async () => {
  const boundaries = await getCachedSanctionedBoundaries(getSanctionedGeoBoundaries);
  const turfPolygons = parseToValidTurfPolygons(boundaries);

  if (turfPolygons.length === 0) {
    logger.warn('No valid polygons found; aborting SanctionBot process.');
    return;
  }

  const { minX, minY, maxX, maxY } = computeBoundingBox(turfPolygons);
  const sellers = await Seller.find({
    $or: [
      {
        sell_map_center: {
          $geoWithin: {
            $box: [
              [minX, minY],
              [maxX, maxY]
            ]
          }
        }
      },
      {
        isRestricted: true // Ensure previously restricted sellers get re-evaluated
      }
    ]
  }).lean();

  const tasks: Promise<SanctionedUpdateResult>[] = [];

  for (const seller of sellers) {
    const point = turf.point(seller.sell_map_center.coordinates);
    const isNowRestricted = turfPolygons.some(p => turf.booleanPointInPolygon(point, p));
    tasks.push(updateAndNotify(seller, isNowRestricted));
  }

  const results = await Promise.allSettled(tasks);
  const stats = summarizeSanctionedResults(results);

  const finalStats = {
    total_sellers_processed: sellers.length,
    changed: stats.changed,
    restricted: stats.restricted,
    unrestricted: stats.unrestricted,
    run_timestamp: new Date().toISOString()
  };

  logger.info('Sanction Bot Statistics', {
    category: 'stats',
    ...finalStats
  });

  return finalStats;
};