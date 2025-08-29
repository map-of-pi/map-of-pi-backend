import { Router } from "express";

import * as toggleController from "../controllers/admin/toggleController";
import { verifyAdminToken } from "../middlewares/verifyToken";

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     AdminPasswordAuth:
 *       type: http
 *       scheme: basic
 *   schemas:
 *     ToggleSchema:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the toggle
 *         enabled:
 *           type: boolean
 *           description: State of the toggle
 *         description:
 *           type: string
 *           description: Description of the toggle
 */
const toggleRoutes = Router();

/**
 * @swagger
 * /api/v1/toggles:
 *   get:
 *     tags:
 *       - Toggle
 *     summary: Get all existing toggles
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '/api/docs/TogglesSchema.yml#/components/schemas/GetAllTogglesRs'
 *       500:
 *         description: Internal server error
 */
toggleRoutes.get("/", toggleController.getToggles);

/**
 * @swagger
 * /api/v1/toggles/{toggle_name}:
 *   get:
 *     tags:
 *       - Toggle
 *     summary: Get the corresponding toggle by toggle name
 *     parameters:
 *       - name: toggle_name
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the toggle to retrieve
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '/api/docs/TogglesSchema.yml#/components/schemas/GetSingleToggleRs'
 *       404:
 *         description: Toggle not found
 *       500:
 *         description: Internal server error
 */
toggleRoutes.get("/:toggle_name", toggleController.getToggle);

/**
 * @swagger
 * /api/v1/toggles/add:
 *   post:
 *     tags:
 *       - Toggle
 *     summary: Add a new toggle *
 *     security:
 *       - AdminPasswordAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '/api/docs/TogglesSchema.yml#/components/schemas/AddToggleRq'
 *     responses:
 *       201:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Toggle successfully added"
 *                 addedToggle:
 *                   $ref: '/api/docs/TogglesSchema.yml#/components/schemas/AddToggleRs'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
toggleRoutes.post("/add", verifyAdminToken, toggleController.addToggle);

/**
 * @swagger
 * /api/v1/toggles/update:
 *   put:
 *     tags:
 *       - Toggle
 *     summary: Update an existing toggle *
 *     security:
 *       - AdminPasswordAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '/api/docs/TogglesSchema.yml#/components/schemas/UpdateToggleRq'
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
 *                   example: "Toggle successfully updated"
 *                 updatedToggle:
 *                   $ref: '/api/docs/TogglesSchema.yml#/components/schemas/UpdateToggleRs'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
toggleRoutes.put("/update", verifyAdminToken, toggleController.updateToggle);

/**
 * @swagger
 * /api/v1/toggles/delete/{toggle_name}:
 *   delete:
 *     tags:
 *       - Toggle
 *     summary: Delete the corresponding toggle by toggle name *
 *     security:
 *       - AdminPasswordAuth: []
 *     parameters:
 *       - name: toggle_name
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the toggle to delete
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
 *                   example: "Toggle successfully deleted"
 *                 deletedToggle:
 *                   $ref: '/api/docs/TogglesSchema.yml#/components/schemas/DeleteToggleRs'
 *       404:
 *         description: Toggle not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
toggleRoutes.delete("/delete/:toggle_name", verifyAdminToken, toggleController.deleteToggle);

export default toggleRoutes;
