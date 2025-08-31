import { findAndRestrictSanctionedSellers } from "../utils/sanctionUtils";
import logger from "../../config/loggingConfig";

export async function runSanctionBot(): Promise<void> {
  logger.info('Sanction Bot cron job started.');
  try {
    await findAndRestrictSanctionedSellers();
  } catch (error) {
    logger.error('Error finding and restricting sanctioned sellers:', error);
    throw error;
  }
}