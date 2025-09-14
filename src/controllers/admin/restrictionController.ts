import { Request, Response } from "express";
import * as restrictionService from "../../services/admin/restriction.service";

import logger from "../../config/loggingConfig";

export const checkSanctionStatus = async (req: Request, res: Response) => {
	const { latitude, longitude } = req.body;

	if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    logger.error(`Invalid coordinates provided as ${latitude}, ${longitude}`);
		return res.status(400).json({ error: 'Unexpected coordinates provided' });
	}

	try {
		const sanctionedRegion = await restrictionService.validateSellerLocation(longitude, latitude);
		const isSanctioned = !!sanctionedRegion;

    const status = isSanctioned ? 'in a sanctioned zone' : 'not in a sanctioned zone';
    logger.info(`User at [${latitude}, ${longitude}] is ${status}.`);
		return res.status(200).json({
			message: `Sell center is set within a ${isSanctioned ? 'sanctioned' : 'unsanctioned' } zone`,
			isSanctioned
		});
	} catch (error) {
		logger.error('Failed to get sanctioned status:', error);
		return res.status(500).json({ 
      message: 'An error occurred while checking sanction status; please try again later' 
    });
	}
};