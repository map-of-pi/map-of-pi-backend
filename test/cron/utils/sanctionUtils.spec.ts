import * as turf from '@turf/turf';
import { 
  findAndRestrictSanctionedSellers,
  parseToValidTurfPolygons, 
  updateAndNotify 
} from '../../../src/cron/utils/sanctionUtils';
import Seller from '../../../src/models/Seller';
import { addNotification } from '../../../src/services/notification.service';
import { ISanctionedGeoBoundary, ISeller } from '../../../src/types';
import logger from '../../../src/config/loggingConfig';
import { 
  getCachedSanctionedBoundaries, 
  summarizeSanctionedResults 
} from '../../../src/helpers/sanction';

jest.mock('../../../src/helpers/sanction');
jest.mock('../../../src/models/Seller');
jest.mock('../../../src/services/notification.service');
jest.mock('../../../src/config/loggingConfig');

describe('updateAndNotify function', () => {
  const mockSeller = {
    _id: 'seller_ID_1',
    seller_id: 'sellerID_1',
    isRestricted: false
  } as ISeller;

  const mockedUpdateOne = Seller.updateOne as jest.Mock;
  const mockedAddNotification = addNotification as jest.Mock;

  it('should skip update and notify if restriction status is unchanged', async () => {
    const result = await updateAndNotify(mockSeller, false);

    expect(mockedUpdateOne).not.toHaveBeenCalled();
    expect(mockedAddNotification).not.toHaveBeenCalled();
    expect(result).toEqual({
      seller_id: 'sellerID_1',
      isChanged: false,
      isRestricted: false,
      isUpdateSuccess: false,
      isNotificationSuccess: false
    });
  });

  it('should update and notify accordingly if restriction status changed', async () => {
    mockedUpdateOne.mockResolvedValueOnce({ acknowledged: true });
    mockedAddNotification.mockResolvedValueOnce(true);

    const result = await updateAndNotify(mockSeller, true);

    expect(mockedUpdateOne).toHaveBeenCalledWith(
      { _id: 'seller_ID_1' },
      expect.objectContaining({
        isRestricted: true,
        sanction_last_checked: expect.any(Date)
      })
    );

    expect(mockedAddNotification).toHaveBeenCalledWith(
      'sellerID_1',
      expect.stringContaining(
        'Your Sell Center is in a Pi Network sanctioned area, so your map marker will no longer appear in searches.'
      )
    );

    expect(result).toEqual({
      seller_id: 'sellerID_1',
      isChanged: true,
      isRestricted: true,
      isUpdateSuccess: true,
      isNotificationSuccess: true
    });
  });

  it('should update successfully but fail to notify', async () => {
    mockedUpdateOne.mockResolvedValueOnce({ acknowledged: true });
    mockedAddNotification.mockRejectedValueOnce(new Error('Unexpected Exception'));

    const result = await updateAndNotify(mockSeller, true);

    expect(mockedUpdateOne).toHaveBeenCalled();
    expect(mockedAddNotification).toHaveBeenCalled();

    expect(result).toEqual({
      seller_id: 'sellerID_1',
      isChanged: true,
      isRestricted: true,
      isUpdateSuccess: true,
      isNotificationSuccess: false
    });
  });

  it('should fail to update and skip notification', async () => {
    mockedUpdateOne.mockRejectedValueOnce(new Error('Unexpected Exception'));

    const result = await updateAndNotify(mockSeller, true);

    expect(mockedUpdateOne).toHaveBeenCalled();
    expect(mockedAddNotification).not.toHaveBeenCalled();

    expect(result).toEqual({
      seller_id: 'sellerID_1',
      isChanged: true,
      isRestricted: true,
      isUpdateSuccess: false,
      isNotificationSuccess: false
    });
  });
});

describe('parseToValidTurfPolygons function', () => {
  it('should parse a valid Polygon and return a turf polygon', () => {
    const mockSanctionedBoundaries: ISanctionedGeoBoundary[] = [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [0, 0], // already closed
            ],
          ],
        },
        properties: {
          shapeName: 'TestShape',
          shapeISO: 'TS',
          shapeID: '1',
          shapeGroup: 'Group1',
          shapeType: 'Country',
        },
        _id: 'BoundariesTest1',
      } as any,
    ];

    const result = parseToValidTurfPolygons(mockSanctionedBoundaries);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('Feature');
    expect(result[0].geometry.type).toBe('Polygon');
    expect(result[0].geometry.coordinates[0]).toEqual([
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 0],
    ]);
  });

  it('should parse a valid MultiPolygon and return multiple turf polygons', () => {
    const mockSanctionedBoundaries: ISanctionedGeoBoundary[] = [
      {
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
            [
              [
                [10, 10],
                [11, 10],
                [11, 11],
                [10, 10],
              ],
            ],
          ],
        },
        properties: {
          shapeName: 'TestMultiShape',
          shapeISO: 'TM',
          shapeID: '2',
          shapeGroup: 'Group2',
          shapeType: 'Region',
        },
        _id: 'BoundariesTest2',
      } as any,
    ];

    const result = parseToValidTurfPolygons(mockSanctionedBoundaries);

    expect(result).toHaveLength(2);

    result.forEach(polygon => {
      expect(polygon.type).toBe('Feature');
      expect(polygon.geometry.type).toBe('Polygon');
    });

    expect(result[0].geometry.coordinates[0][0]).toEqual([0, 0]);
    expect(result[1].geometry.coordinates[0][0]).toEqual([10, 10]);
  });

  it('should skip polygon with too few coordinates', () => {
    const mockSanctionedBoundaries: ISanctionedGeoBoundary[] = [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [0, 0], // too few points to form valid ring
            ],
          ],
        },
        properties: {
          shapeName: 'IncompleteShape',
          shapeISO: 'IS',
          shapeID: '3',
          shapeGroup: 'Group3',
          shapeType: 'Incomplete',
        },
        _id: 'BoundariesTest3',
      } as any,
    ];

    const result = parseToValidTurfPolygons(mockSanctionedBoundaries);

    expect(result).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith('Skipping Polygon: too few coordinates');
  });

  it('should skip unknown geometry types', () => {
    const mockSanctionedBoundaries: any[] = [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
        properties: {},
        _id: 'BoundariesTest4',
      },
    ];

    const result = parseToValidTurfPolygons(mockSanctionedBoundaries);

    expect(result).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith('Skipping Polygon/ MultiPolygon: unknown geometry type:', 'LineString');
  });

  it('should catch and log an error when polygon parsing fails', () => {
    const mockSanctionedBoundaries: any[] = [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: null, // malformed, should cause error in processPolygon
        },
        properties: {},
        _id: 'BoundariesTest5',
      },
    ];

    const result = parseToValidTurfPolygons(mockSanctionedBoundaries);

    expect(result).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse polygon:'), 'BoundariesTest5'
    );
  });
});

describe('findAndRestrictSanctionedSellers function', () => {
  it('should process sellers and log the Sanctioned stats accordingly', async () => {
    const mockSellers = [
      { _id: 'seller_id1', seller_id: 'sellerId1', sell_map_center: { coordinates: [0.5, 0.5] }, isRestricted: false },
      { _id: 'seller_id2', seller_id: 'sellerId2', sell_map_center: { coordinates: [2, 2] }, isRestricted: true },
    ];

    // ensure valid polygon geometry
    (getCachedSanctionedBoundaries as jest.Mock).mockResolvedValue([
      { geometry: turf.polygon([[[0,0],[0,1],[1,1],[0,0]]]).geometry }
    ]);

    (Seller.find as jest.Mock).mockReturnValue({ lean: () => mockSellers });
    (Seller.updateOne as jest.Mock).mockResolvedValue({ acknowledged: true });

    (addNotification as jest.Mock).mockResolvedValue(true);

    (summarizeSanctionedResults as jest.Mock).mockReturnValue({
      changed: 2,
      restricted: 1,
      unrestricted: 1
    });

    await findAndRestrictSanctionedSellers();

    expect(Seller.find).toHaveBeenCalledWith({
      $or: [
        {
          sell_map_center: {
            $geoWithin: {
              $box: [
                [0, 0],
                [1, 1]
              ]
            }
          }
        },
        {
          isRestricted: true
        }
      ]
    });

    expect(Seller.updateOne).toHaveBeenCalledTimes(2);
    expect(addNotification).toHaveBeenCalledTimes(2);
    expect(summarizeSanctionedResults).toHaveBeenCalledWith(expect.any(Array));
    expect(logger.info).toHaveBeenCalledWith(
      'Sanction Bot Statistics',
      expect.objectContaining({
        category: 'stats',
        total_sellers_processed: 2,
        changed: 2,
        restricted: 1,
        unrestricted: 1,
        run_timestamp: expect.any(String) // since it's a timestamp string
      })
    );
  });

  it('should abort if no polygons are returned', async () => {
    // ensure invalid polygon geometry
    (getCachedSanctionedBoundaries as jest.Mock).mockResolvedValue([
      {
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [0, 0] // only 3 points, not enough for valid ring
            ]
          ]
        }
      }
    ]);
    
    await findAndRestrictSanctionedSellers();

    expect(logger.warn).toHaveBeenCalledWith('No valid polygons found; aborting SanctionBot process.');
    expect(Seller.find).not.toHaveBeenCalled();
    expect(Seller.updateOne).not.toHaveBeenCalled();
    expect(addNotification).not.toHaveBeenCalled();
  });
});