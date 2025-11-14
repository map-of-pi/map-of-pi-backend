import {Router} from "express";

import * as cronController from "../controllers/admin/cronController";
import { verifyAdminToken } from "../middlewares/verifyToken";

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     AdminPasswordAuth:
 *       type: http
 *       scheme: basic
 */
const cronRoutes = Router();

/**
 * @swagger
 * /api/v1/cron/sanction-bot:
 *   post:
 *     tags:
 *       - Cron
 *     summary: Execute Sanction Bot *
 *     description: Executes the Sanction Bot to find and restrict sanctioned sellers immediately.
 *     security:
 *       - AdminPasswordAuth: []
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Sanction Bot execution successfully completed
 *                 data:
 *                   type: object
 *                   description: Statistics from the Sanction Bot run
 *                   example:
 *                     total_sellers_processed: 100
 *                     changed: 10
 *                     restricted: 10
 *                     unrestricted: 90
 *                     run_timestamp: 2025-08-08T17:25:43.511Z
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
cronRoutes.post("/sanction-bot", verifyAdminToken, cronController.runSanctionBot);

export default cronRoutes;