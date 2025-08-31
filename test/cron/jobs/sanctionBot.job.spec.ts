import { runSanctionBot } from '../../../src/cron/jobs/sanctionBot.job';
import * as sanctionUtils from '../../../src/cron/utils/sanctionUtils';
import logger from '../../../src/config/loggingConfig';

jest.mock('../../../src/cron/utils/sanctionUtils');
jest.mock('../../../src/config/loggingConfig');

describe("runSanctionBot function", () => {
  it('should invoke process and run to completion when no exception occurs', async () => {
    (sanctionUtils.findAndRestrictSanctionedSellers as jest.Mock).mockResolvedValue(undefined);
    
    await runSanctionBot();

    expect(logger.info).toHaveBeenCalledWith('Sanction Bot cron job started.');
    expect(sanctionUtils.findAndRestrictSanctionedSellers).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should invoke process and throw an error when an exception occurs', async () => {
    const mockError = new Error('Utility level error');
    (sanctionUtils.findAndRestrictSanctionedSellers as jest.Mock).mockRejectedValue(mockError);
    
    await expect(runSanctionBot()).rejects.toThrow(mockError);

    expect(logger.info).toHaveBeenCalledWith('Sanction Bot cron job started.');
    expect(sanctionUtils.findAndRestrictSanctionedSellers).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Error finding and restricting sanctioned sellers:',
      mockError
    );
  });
});