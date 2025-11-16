import { findAndRestrictSanctionedSellers } from "../../cron/utils/sanctionUtils";
import logger from "../../config/loggingConfig";

export const runSanctionCheck = async () => {
  try {
    return await findAndRestrictSanctionedSellers();
  } catch (error) {
    logger.error(`Failed to find and restrict sanctioned sellers: ${ error }`);
    throw error;
  }
};