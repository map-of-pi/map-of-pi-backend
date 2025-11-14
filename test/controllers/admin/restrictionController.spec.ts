import { checkSanctionStatus } from '../../../src/controllers/admin/restrictionController';
import * as restrictionService from '../../../src/services/admin/restriction.service';

jest.mock('../../../src/services/admin/restriction.service', () => ({
  validateSellerLocation: jest.fn(),
}));

describe('RestrictionController', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('checkSanctionedStatus function', () => {
    const mockSanctionedRegion = { _id: 'mockId' };

    it('should return [200] and isSanctioned true if seller is in a sanctioned zone', async () => {
      req.body = { latitude: 123.5, longitude: 40.5 };
      (restrictionService.validateSellerLocation as jest.Mock).mockResolvedValue(mockSanctionedRegion);

      await checkSanctionStatus(req, res);
      expect(restrictionService.validateSellerLocation).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Sell center is set within a sanctioned zone',
        isSanctioned: true,
      });
    });

    it('should return [200] and isSanctioned false if seller is not in a sanctioned zone', async () => {
      req.body = { latitude: 23.5, longitude: 40.5 };
      (restrictionService.validateSellerLocation as jest.Mock).mockResolvedValue(null);

      await checkSanctionStatus(req, res);
      expect(restrictionService.validateSellerLocation).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Sell center is set within a unsanctioned zone',
        isSanctioned: false,
      });
    });

    it('should return [400] if latitude or longitude is missing or invalid', async () => {
      req.body = { latitude: "malformed", longitude: null };
  
      await checkSanctionStatus(req, res);
  
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unexpected coordinates provided" });
    });

    it('should return [500] if service throws an error', async () => {
      const mockError = new Error('An error occurred while checking sanction status; please try again later');
      
      req.body = { latitude: 23.5, longitude: 40.5 };
      (restrictionService.validateSellerLocation as jest.Mock).mockRejectedValue(mockError);
  
      await checkSanctionStatus(req, res);
      
      expect(restrictionService.validateSellerLocation).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });
  });
});