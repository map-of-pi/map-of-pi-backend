import { Router } from "express";

import * as sellerController from "../controllers/sellerController";
import { isSellerFound } from "../middlewares/isSellerFound";
import { verifyToken } from "../middlewares/verifyToken";
import { isToggle } from "../middlewares/isToggle";
import upload from "../utils/multer";

/**
 * @swagger
 * components:
 *   schemas:
 *     SellerSchema:
 *       type: object
 *       properties:
 *         seller_id:
 *           type: string
 *           description: Pi user ID of the seller
 *         name:
 *           type: string
 *           description: Name of the seller
 *         description:
 *           type: string
 *           description: Description of the seller
 *         seller_type:
 *           $ref: '/api/docs/enum/SellerType.yml#/components/schemas/SellerType'
 *         image:
 *           type: string
 *           description: Image of the seller
 *         address:
 *           type: string
 *           description: Address of the seller
 *         average_rating:
 *           type: object
 *           description: Average rating of the seller
 *           properties:
 *             $numberDecimal:
 *               type: string
 *           required:
 *             - $numberDecimal
 *         sell_map_center:
 *           type: object
 *           description: Geographical coordinates of the seller's location
 *           properties:
 *             type:
 *               type: string
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *           required:
 *             - type
 *             - coordinates
 *         fulfillment_type:
 *           $ref: '/api/docs/enum/FulfillmentType.yml#/components/schemas/FulfillmentType'
 *         fulfillment_description:
 *           type: string
 *           description: Description of the fulfillment
 *         order_online_enabled_pref:
 *           type: boolean
 *           description: Preference for online ordering availability
 * 
 *     SellerItemSchema:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique ID of the seller item
 *         seller_id:
 *           type: string
 *           description: Pi user ID of the seller associated with the item
 *         name:
 *           type: string
 *           description: Name of the item
 *         description:
 *           type: string
 *           description: Description of the item
 *         price:
 *           type: object
 *           description: Pi cost of the item
 *           properties:
 *             $numberDecimal:
 *               type: string
 *           required:
 *             - $numberDecimal
 *         stock_level:
 *           $ref: '/api/docs/enum/StockLevelType.yml#/components/schemas/StockLevelType'
 *         image:
 *           type: string
 *           description: Image of the item
 *         duration:
 *           type: number
 *           description: Duration of the item in whole number weeks
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Date when the item is created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Date when the item is updated
 *         expired_by:
 *           type: string
 *           format: date-time
 *           description: Date when the item is expired
 */
const sellerRoutes = Router();

/**
 * @swagger
 * /api/v1/sellers/fetch:
 *   post:
 *     tags:
 *       - Seller
 *     summary: Fetch all filtered sellers within the visible map area (bounding box) | sorted by reviews with a maximum of 50 sellers *
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '/api/docs/SellersSchema.yml#/components/schemas/GetAllSellersRq'
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '/api/docs/SellersSchema.yml#/components/schemas/GetAllSellersRs'
 *       204:
 *         description: Sellers not found
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
sellerRoutes.post("/fetch", verifyToken, sellerController.fetchSellersByCriteria);

/**
 * @swagger
 * /api/v1/sellers/{seller_id}:
 *   get:
 *     tags:
 *       - Seller
 *     summary: Get a single seller by seller ID
 *     parameters:
 *       - name: seller_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The Pi UID of the seller to retrieve
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/SellersSchema.yml#/components/schemas/GetSingleSellerRs'
 *       404:
 *         description: Seller not found
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
sellerRoutes.get("/:seller_id", sellerController.getSingleSeller);

/**
 * @swagger
 * /api/v1/sellers/me:
 *   post:
 *     tags:
 *       - Seller
 *     summary: Fetch the user's seller registration using Bearer Auth token *
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/SellersSchema.yml#/components/schemas/GetSellerRegistrationRs'
 *       404:
 *         description: Seller registration not found | Seller not found
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */  
sellerRoutes.post(
  "/me", 
  verifyToken,
  isSellerFound,
  sellerController.fetchSellerRegistration
);

/**
 * @swagger
 * /api/v1/sellers/register:
 *   put:
 *     tags:
 *       - Seller
 *     summary: Register a new seller or update existing seller *
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '/api/docs/SellersSchema.yml#/components/schemas/RegisterSellerRq'
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/SellersSchema.yml#/components/schemas/RegisterSellerRs'
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
sellerRoutes.put(
  "/register",
  verifyToken,
  upload.single("image"),
  sellerController.registerSeller
);

/**
 * @swagger
 * /api/v1/sellers/delete:
 *   delete:
 *     tags:
 *       - Seller
 *     summary: Delete a seller by seller ID *
 *     responses:
 *       200:
 *         description: Successful response | Seller deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/SellersSchema.yml#/components/schemas/DeleteSellerRs'
 *       404:
 *         description: Seller not found
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
sellerRoutes.delete(
  "/delete",
  verifyToken,
  isSellerFound,
  sellerController.deleteSeller
);

/**
 * @swagger
 * /api/v1/sellers/item/{seller_id}:
 *   get:
 *     tags:
 *       - Seller Item
 *     summary: Get items associated with the seller ID
 *     parameters:
 *       - name: seller_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The Pi UID of the seller to retrieve
 *     responses:
 *       204:
 *         description: Seller items not found
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
*                $ref: '/api/docs/SellersItemSchema.yml#/components/schemas/GetSellerItemsRs'
 *       404:
 *         description: Seller not found
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
sellerRoutes.get(
  "/item/:seller_id", 
  isToggle("onlineShoppingFeature"), 
  sellerController.getSellerItems
);

/**
 * @swagger
 * /api/v1/sellers/item/add:
 *   put:
 *     tags:
 *       - Seller Item
 *     summary: Add a seller item or update existing seller item *
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '/api/docs/SellersItemSchema.yml#/components/schemas/AddSellerItemRq' 
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/SellersItemSchema.yml#/components/schemas/AddSellerItemRs'
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
sellerRoutes.put(
  "/item/add",
  isToggle("onlineShoppingFeature"),  
  verifyToken,
  isSellerFound,
  upload.single("image"),
  sellerController.addOrUpdateSellerItem
);

/**
 * @swagger
 * /api/v1/sellers/item/delete/{seller_item_id}:
 *   delete:
 *     tags:
 *       - Seller Item
 *     summary: Delete a seller item by item ID *
 *     parameters:
 *       - name: seller_item_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The item ID of the seller item to delete
 *     responses:
 *       200:
 *         description: Successful response | Seller item deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/SellersItemSchema.yml#/components/schemas/DeleteSellerItemRs'
 *       404:
 *         description: Seller not found
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
sellerRoutes.delete(
  "/item/delete/:item_id",
  isToggle("onlineShoppingFeature"),
  verifyToken,
  isSellerFound,
  sellerController.deleteSellerItem
);

export default sellerRoutes;
