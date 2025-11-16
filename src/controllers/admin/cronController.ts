import { Request, Response } from "express";
import * as cronService from "../../services/admin/cron.service";
import logger from "../../config/loggingConfig";

export const runSanctionBot = async (req: Request, res: Response) => {
  try {
    const result = await cronService.runSanctionCheck();

    return res.status(200).json({
      success: true,
      message: "Sanction Bot execution successfully completed",
      data: result
    });
  } catch (error: any) {
    logger.error("Sanction Bot execution failed", { error });
    
    return res.status(500).json({
      success: false,
      message: "Sanction Bot execution failed",
      error: error.message
    });
  }
};