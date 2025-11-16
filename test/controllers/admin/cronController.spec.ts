import { runSanctionBot } from '../../../src/controllers/admin/cronController';
import * as cronService from '../../../src/services/admin/cron.service';

jest.mock('../../../src/services/admin/cron.service');

describe('CronController', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('runSanctionBot function', () => {
    it('should return [200] and Sanctioned Seller stats upon success', async () => {
      const mockStats = {
        total_sellers_processed: 10,
        changed: 2,
        restricted: 2,
        unrestricted: 8,
        run_timestamp: "2025-08-08T17:25:43.511Z",
      };

      (cronService.runSanctionCheck as jest.Mock).mockResolvedValue(mockStats);

      await runSanctionBot(req, res);

      expect(cronService.runSanctionCheck).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Sanction Bot execution successfully completed",
        data: mockStats,
      });
    });

    it('should return [500] when Sanctioned Seller bot fails', async () => {
      const mockError = new Error('Mock service layer error');
      (cronService.runSanctionCheck as jest.Mock).mockRejectedValue(mockError);
  
      await runSanctionBot(req, res);
  
      expect(cronService.runSanctionCheck).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Sanction Bot execution failed",
        error: mockError.message,
      });
    });
  });
});