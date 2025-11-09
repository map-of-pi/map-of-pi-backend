import { Router } from "express";

import * as orderController from "../controllers/orderController";
import { isSellerFound } from "../middlewares/isSellerFound";
import { verifyToken } from "../middlewares/verifyToken";

/**
 * @swagger
 * components:
 *   schemas:
 *     OrderSchema:
 *       type: object
 *       properties:
 *         payment_id:
 *           type: string
 *           description: Unique ID of the Pi payment
 *         buyer_id:
 *           type: string
 *           description: The Pi UID of the buyer
 *         seller_id:
 *           type: string
 *           description: The Pi UID of the seller
 *         total_amount:
 *           type: object
 *           description: Total Pi currency price of the order
 *           properties:
 *             $numberDecimal:
 *               type: string
 *           required:
 *             - $numberDecimal
 *         is_paid:
 *           type: boolean
 *           description: Determine if the order has been completely paid by the buyer
 *         is_fulfilled:
 *           type: boolean
 *           description: Determine if the order has been successfully fulfilled by the seller
 *         status:
 *           $ref: '/api/docs/enum/OrderStatusType.yml#/components/schemas/OrderStatusType'
 *         fulfillment_type:
 *           $ref: '/api/docs/enum/FulfillmentType.yml#/components/schemas/FulfillmentType'
 *         buyer_fulfillment_description:
 *           type: string
 *           description: Fulfillment details from buyer.
 *         seller_fulfillment_description:
 *           type: string
 *           description: Fulfillment details from seller.
 * 
 *     OrderItemSchema:
 *       type: object
 *       properties:
 *         order_id:
 *           type: string
 *           description: Unique ID of the order item
 *         seller_item_id:
 *           type: string
 *           description: Unique ID of the seller item
 *         quantity:
 *           type: number
 *           description: Ordered quantity of the seller item
 *         subtotal:
 *           type: object
 *           description: Subtotal of the ordered seller item
 *           properties:
 *             $numberDecimal:
 *               type: string
 *           required:
 *             - $numberDecimal
 *         status:
 *           $ref: '/api/docs/enum/OrderItemStatusType.yml#/components/schemas/OrderItemStatusType'
 */
const orderRoutes = Router();

/**
 * @swagger
 * /api/v1/orders/seller-orders:
 *   get:
 *     tags:
 *       - Order
 *     summary: Get orders associated with the seller *
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
*                $ref: '/api/docs/OrdersSchema.yml#/components/schemas/GetOrdersRs'
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
orderRoutes.get("/seller-orders", verifyToken, isSellerFound, orderController.getSellerOrders);

/**
 * @swagger
 * /api/v1/orders/review/buyer-orders:
 *   get:
 *     tags:
 *       - Order
 *     summary: Get orders associated with the buyer *
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
*                $ref: '/api/docs/OrdersSchema.yml#/components/schemas/GetOrdersRs'
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
orderRoutes.get("/review/buyer-orders", verifyToken, orderController.getBuyerOrders);

/**
 * @swagger
 * /api/v1/orders/{order_id}:
 *   get:
 *     tags:
 *       - Order
 *     summary: Get a single order and its associated order items by order ID *
 *     parameters:
 *       - name: order_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The order ID of the order to retrieve
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
*                $ref: '/api/docs/OrdersSchema.yml#/components/schemas/GetSingleOrderRs'
 *       404:
 *         description: Order not found
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
orderRoutes.get("/:order_id", verifyToken, orderController.getSingleOrder);

/**
 * @swagger
 * /api/v1/orders/:
 *   post:
 *     tags:
 *       - Order
 *     summary: Create a new order *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '/api/docs/OrdersSchema.yml#/components/schemas/CreateOrderRq'
 *     responses:
 *       201:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/OrdersSchema.yml#/components/schemas/GetSingleOrderRs'
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request | Invalid order data
 *       500:
 *         description: Internal server error
 */  
orderRoutes.post("/", verifyToken, orderController.createOrder);

/**
 * @swagger
 * /api/v1/orders/{order_id}:
 *   delete:
 *     tags:
 *       - Order
 *     summary: Delete a order by order ID *
 *     parameters:
 *       - name: order_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The order ID of the order to delete
 *     responses:
 *       200:
 *         description: Successful response | Order deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/OrdersSchema.yml#/components/schemas/DeleteOrderRs'
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
orderRoutes.delete("/:order_id", verifyToken, orderController.deleteOrder);

/**
 * @swagger
 * /api/v1/orders/update/{order_id}:
 *   put:
 *     tags:
 *       - Order
 *     summary: Update the order status of an existing order *
 *     parameters:
 *       - name: order_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The order ID of the order to update it's status
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderStatus
 *             properties:
 *               orderStatus:
 *                 $ref: '/api/docs/enum/OrderStatusType.yml#/components/schemas/OrderStatusType'
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/OrdersSchema.yml#/components/schemas/GetSingleOrderRs'
 *       404:
 *         description: Order not found or could not be updated
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
orderRoutes.put("/update/:order_id", verifyToken, orderController.updateOrderStatus);

/**
 * @swagger
 * /api/v1/orders/item/{orderitem_id}:
 *   put:
 *     tags:
 *       - Order
 *     summary: Update the order item status of an existing order item *
 *     parameters:
 *       - name: orderitem_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The order item ID associated with the order item to update it's status
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderItemStatus
 *             properties:
 *               orderItemStatus:
 *                 $ref: '/api/docs/enum/OrderItemStatusType.yml#/components/schemas/OrderItemStatusType'
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/OrderItemSchema.yml#/components/schemas/GetOrderItemRs'
 *       404:
 *         description: Order item not found or could not be updated
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
orderRoutes.put("/item/:orderitem_id", verifyToken, isSellerFound, orderController.updateOrderItemStatus);

export default orderRoutes;