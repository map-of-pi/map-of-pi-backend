import * as sanctionUtils from '../../../src/cron/utils/sanctionUtils';
import * as cronService from '../../../src/services/admin/cron.service';

jest.mock('../../../src/cron/utils/sanctionUtils');

describe('runSanctionCheck function', () => {
  it('should return Sanctioned Seller stats on success', async () => {
    const mockStats = {
      total_sellers_processed: 10,
      changed: 2,
      restricted: 2,
      unrestricted: 8,
      run_timestamp: "2025-08-08T17:25:43.511Z",
    };

    (sanctionUtils.findAndRestrictSanctionedSellers as jest.Mock).mockResolvedValue(mockStats);

    const result = await cronService.runSanctionCheck();

    expect(sanctionUtils.findAndRestrictSanctionedSellers).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockStats);
  });

  it('should throw an error when an exception occurs', async () => {
    const mockError = new Error('Mock service layer error');

    (sanctionUtils.findAndRestrictSanctionedSellers as jest.Mock).mockRejectedValue(mockError);

    await expect(cronService.runSanctionCheck()).rejects.toThrow('Mock service layer error');
  });
});