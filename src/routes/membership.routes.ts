import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import * as membershipController from "../controllers/membershipController";

/**
 * @swagger
 * components:
 *   schemas:
 *     MembershipSchema:
 *       type: object
 *       properties:
 *         user_id:
 *           type: string
 *           description: Membership ID of the user
 *         pi_uid:
 *           type: string
 *           description: Pi user ID of the user
 *         membership_class:
 *           $ref: '/api/docs/enum/MembershipClassType.yml#/components/schemas/MembershipClassType'
 *         mappi_balance:
 *           type: object
 *           description: Total Mappi credits of the user
 *           properties:
 *             $numberDecimal:
 *               type: string
 *           required:
 *             - $numberDecimal
 *         membership_expiry_date:
 *           type: string
 *           description: Membership expiration date
 *           format: date-time
 *
 *     MembershipTiers:
 *       type: object
 *       properties:
 *         value:
 *           $ref: '/api/docs/enum/MembershipClassType.yml#/components/schemas/MembershipClassType'
 *         cost:
 *           type: number
 *           description: Cost of the membership in Pi
 *         duration:
 *           type: integer
 *           description: Duration of the membership in weeks; null if not applicable
 *         mappi_allowance:
 *           type: integer
 *           description: Number of Mappi associated with this membership
 */
const membershipRoutes = Router();

/**
 * @swagger
 * /api/v1/memberships/membership-list:
 *   get:
 *     tags:
 *       - Membership
 *     summary: Get the Membership tiers list
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/MembershipsSchema.yml#/components/schemas/MembershipTiers'
 *       404:
 *         description: Membership list not found
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
membershipRoutes.get(
  "/membership-list",
  membershipController.getMembershipList
);

/**
 * @swagger
 * /api/v1/memberships/{membership_id}:
 *   get:
 *     tags:
 *       - Membership
 *     summary: Get a single membership by membership ID
 *     parameters:
 *       - name: membership_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The Pi UID of the membership to retrieve
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/MembershipsSchema.yml#/components/schemas/MembershipRs'
 *       404:
 *         description: Membership not found
 *       500:
 *         description: Internal server error
 */
membershipRoutes.get(
  "/:membership_id",
  membershipController.getSingleMembership
);

/**
 * @swagger
 * /api/v1/memberships/:
 *   get:
 *     tags:
 *       - Membership
 *     summary: Fetch the user's current membership record *
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/MembershipsSchema.yml#/components/schemas/MembershipRs'
 *       404:
 *         description: User membership not found
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
membershipRoutes.get(
  "/",
  verifyToken,
  membershipController.fetchUserMembership
);

/**
 * @swagger
 * /api/v1/memberships/manage:
 *   put:
 *     tags:
 *       - Membership
 *     summary: Register or update the authenticated user's membership *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - membership_class
 *             properties:
 *               membership_class:
 *                 $ref: '/api/docs/enum/MembershipClassType.yml#/components/schemas/MembershipClassType'
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/MembershipsSchema.yml#/components/schemas/MembershipRs'
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
membershipRoutes.put(
  "/manage",
  verifyToken,
  membershipController.updateMembership
);

/**
 * @swagger
 * /api/v1/memberships/deduct-mappi:
 *   post:
 *     tags:
 *       - Membership
 *     summary: Deduct Mappi credits from a user for TrustProtect usage
 *     security:
 *       - bearerAuth: []  # Ensures only authenticated users can perform this action
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 100
 *                 description: Amount of Mappi to deduct (e.g., 100)
 *     responses:
 *       200:
 *         description: Mappi deducted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 balance:
 *                   type: number
 *                 mappi_used_to_date:
 *                   type: number
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
membershipRoutes.post(
  "/deduct-mappi",
  verifyToken,
  membershipController.deductMappi
);

export default membershipRoutes;
