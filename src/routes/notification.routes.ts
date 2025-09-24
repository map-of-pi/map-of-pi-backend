import { Router } from "express";

import * as notificationController from "../controllers/notificationController";
import { verifyToken } from "../middlewares/verifyToken";

/**
 * @swagger
 * components:
 *   schemas:
 *     NotificationSchema:
 *       type: object
 *       properties:
 *         pi_uid:
 *           type: string
 *           description: Pi user ID associated with the notification
 *         is_cleared:
 *           type: boolean
 *           description: Current status of the notification
 *         reason:
 *           type: string
 *           description: Details on the reason for the notification
 */
const notificationRoutes = Router();

/**
 * @swagger
 * /api/v1/notifications/{pi_uid}:
 *   get:
 *     tags: 
 *      - Notification
 *     summary: Get notifications associated with the user
 *     parameters:
 *       - name: pi_uid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The Pi UID of the notifications to retrieve
 *       - name: skip
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of notifications to return
 *       - name: status
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [cleared, uncleared]
 *         description: Filter notifications by cleared vs uncleared status, if applicable.
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '/api/docs/NotificationsSchema.yml#/components/schemas/Notification'
 *       500:
 *         description: Internal server error
 */
notificationRoutes.get("/", verifyToken, notificationController.getNotifications);

/**	
 * @swagger	
 * /api/v1/notifications/:	
 *   post:	
 *     tags: 	
 *      - Notification	
 *     summary: Create a new notification *	
 *     requestBody:	
 *       required: true	
 *       content:	
 *         application/json:	
 *           schema:	
 *             type: object	
 *             properties:	
 *               reason:	
 *                 type: string	
 *                 example: This is a sample reason for notification.	
 *     responses:	
 *       200:	
 *         description: Successful response	
 *         content:	
 *           application/json:	
 *             schema:	
 *               type: object	
 *               properties:	
 *                 message:	
 *                   type: string	
 *                   example: Notification created successfully	
 *                 notification:	
 *                   $ref: '/api/docs/NotificationsSchema.yml#/components/schemas/Notification'	
 *       401:	
 *         description: Unauthorized	
 *       500:	
 *         description: Internal server error	
 */	
notificationRoutes.post("/", verifyToken, notificationController.createNotification);	

/**
 * @swagger
 * /api/v1/notifications/count:
 *   get:
 *     tags:
 *       - Notification
 *     summary: Get the count of notifications filtered by status (cleared or uncleared)
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [cleared, uncleared]
 *         required: false
 *         description: Filter notifications by status
 *     responses:
 *       200:
 *         description: Successful response with notification count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 5
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
notificationRoutes.get("/count", verifyToken, notificationController.getNotificationsCount);

/**
 * @swagger
 * /api/v1/notifications/update/{notification_id}:
 *   put:
 *     tags:
 *       - Notification
 *     summary: Update by toggling the notification status *
 *     parameters:
 *       - name: notification_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the notification to toggle
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Notification updated successfully
 *                 notification:
 *                   $ref: '/api/docs/NotificationsSchema.yml#/components/schemas/Notification'
 *       404:
 *         description: Notification not found or could not be updated
 *       500:
 *         description: Internal server error
 */
notificationRoutes.put("/update/:notification_id", verifyToken, notificationController.updateNotification);

export default notificationRoutes;