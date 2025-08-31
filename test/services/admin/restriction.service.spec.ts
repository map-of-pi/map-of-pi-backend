import { validateSellerLocation } from '../../../src/services/admin/restriction.service';
import SanctionedGeoBoundary from '../../../src/models/misc/SanctionedGeoBoundary';

jest.mock('../../../src/models/misc/SanctionedGeoBoundary');

describe('validateSellerLocation function', () => {
  const longitude = 123.5;
  const latitude = 40.5;

  const mockSanctionedRegion = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [123.5, 37.5],
        [131.2, 37.5],
        [131.2, 43.0],
        [123.5, 43.0],
        [123.5, 37.5],
      ]],
    },
    properties: {
      shapeName: 'North Korea',
      shapeISO: 'PRK',
      shapeID: '001',
      shapeGroup: 'Asia',
      shapeType: 'Country',
    }
  };

  it('should return the sanctioned region if the seller location intersects a restricted boundary', async () => {
    (SanctionedGeoBoundary.findOne as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockSanctionedRegion),
    });

    const result = await validateSellerLocation(longitude, latitude);

    expect(SanctionedGeoBoundary.findOne).toHaveBeenCalledWith({
      geometry: {
        $geoIntersects: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
        },
      },
    });

    expect(result).toEqual(mockSanctionedRegion);
  });

  it('should return null if the seller location does not intersect any restricted boundary', async () => {
    (SanctionedGeoBoundary.findOne as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    const result = await validateSellerLocation(longitude, latitude);
    expect(result).toBeNull();
  });

  it('should throw an error when an exception occurs', async () => {
    const mockError = new Error('Mock database error');

    (SanctionedGeoBoundary.findOne as jest.Mock).mockReturnValue({
      exec: jest.fn().mockRejectedValue(mockError),
    });
  
    await expect(validateSellerLocation(longitude, latitude)).rejects.toThrow('Mock database error');
  });
});