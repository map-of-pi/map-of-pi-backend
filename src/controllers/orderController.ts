import { Request, Response } from "express";
import { OrderItemStatusType } from "../models/enums/orderItemStatusType";
import { OrderStatusType } from "../models/enums/orderStatusType";
import *  as orderService from "../services/order.service";
import { ISeller, IUser, NewOrder } from "../types";
import logger from "../config/loggingConfig";

export const getSellerOrders = async (req: Request, res: Response) => {
  const seller = req.currentSeller as ISeller; 
  try {
    // Pagination with expected defaults (1–100)
    const skip = Math.max(0, Math.floor(Number(req.query.skip) || 0));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 20)));

    // Validate status filter
    const validStatuses = ['initialized', 'pending', 'completed', 'cancelled'];
    const status = validStatuses.includes(req.query.status as string)
      ? (req.query.status as OrderStatusType)
      : undefined;

    const { items, count } = await orderService.getSellerOrdersById(
      seller.seller_id,
      skip,
      limit,
      status
    );
    return res.status(200).json({ items, count });
  } catch (error) {
    logger.error(`Failed to get seller orders for sellerID ${ seller.seller_id }:`, error);
    return res.status(500).json({ 
      message: 'An error occurred while getting seller orders; please try again later' 
    });
  }
};

export const getBuyerOrders = async (req: Request, res: Response) => {
  const buyer = req.currentUser as IUser;
  try {
    // Pagination with expected defaults (1–100)
    const skip = Math.max(0, Math.floor(Number(req.query.skip) || 0));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 20)));

    // Validate status filter
    const validStatuses = ['initialized', 'pending', 'completed', 'cancelled'];
    const status = validStatuses.includes(req.query.status as string)
      ? (req.query.status as OrderStatusType)
      : undefined;

    const { items, count } = await orderService.getBuyerOrdersById(
      buyer.pi_uid,
      skip,
      limit,
      status
    );
    return res.status(200).json({ items, count });
  } catch (error) {
    logger.error(`Failed to get buyer orders for piUID ${ buyer.pi_uid }:`, error);
    return res.status(500).json({ 
      message: 'An error occurred while getting buyer orders; please try again later' 
    });
  }
};

export const getSingleOrder = async (req: Request, res: Response) => {
  const orderId = req.params.order_id;
  try {
    const order = await orderService.getOrderItems(orderId);
    if (!order) {
      logger.warn(`Order with ID ${orderId} not found.`);
      return res.status(404).json({ message: "Order not found" });
    }
    logger.info(`Fetched order with ID ${orderId}`);
    return res.status(200).json(order);
  } catch (error) {
    logger.error(`Failed to get single order for orderID ${ orderId }:`, error);
    return res.status(500).json({ 
      message: 'An error occurred while getting single order; please try again later' 
    });
  }
};

// TODO: To be removed once payment service is fully integrated
export const createOrder = async (req: Request, res: Response) => {
  const buyer = req.currentUser as IUser;
  const { orderData, orderItems } = req.body;
  try {
    // Ensure no payment ID is attached
    const sanitizedOrderData: NewOrder = { 
      ...orderData, 
      paymentId: null, 
      orderItems, 
      buyerPiUid: buyer.pi_uid 
    };

    const order = await orderService.createOrder(sanitizedOrderData);
    if (!order) {
      logger.error(`Failed to create order with provided data: ${JSON.stringify(sanitizedOrderData)}`);
      return res.status(400).json({ message: "Invalid order data" });
    }

    // Mark the order as paid (temporary behavior)
    const paidOrder = await orderService.markAsPaidOrder(order._id as string);
    return res.status(200).json(paidOrder);
  } catch (error) {
    logger.error(`Failed to create order:`, error);
    return res.status(500).json({ 
      message: 'An error occurred while creating order; please try again later'
    });
  }
};

export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const deletedOrder = await orderService.deleteOrderById(req.params.order_id);
    if (!deletedOrder) {
      logger.warn(`Order not found.`);
      return res.status(404).json({ message: "Order not found" });
    }
    return res.status(200).json({ message: "Order deleted successfully", deletedOrder });
  } catch (error) {
    logger.error('Failed to delete order', error);
    return res.status(500).json({ message: 'An error occurred while deleting order; please try again later' });
  }
};

export const getOrderItems = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  try {
    const items = await orderService.getOrderItems(orderId);

    if (!items) {
      logger.error(`No items are found for order: ${orderId}`);
      return res.status(404).json({ message: "No items found for this order" });
    }
    return res.status(200).json(items);
  } catch (error) {
    logger.error('Failed to fetch order items:', error);
    return res.status(500).json({ message: 'An error occurred while getting order items; please try again later' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { order_id } = req.params;
  const { orderStatus } = req.body;
  try {
    const updatedOrder = await orderService.updateOrderStatus(order_id, orderStatus);
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found or could not be updated" });
    }
    return res.status(200).json(updatedOrder);
  } catch (error) {
    logger.error('Failed to update order status:', error);
    return res.status(500).json({ message: 'An error occurred while updating order status; please try again later' });
  }
};

export const updateOrderItemStatus = async (req: Request, res: Response) => {
  const { orderitem_id } = req.params;
  const { orderItemStatus } = req.body;
  try {
    if (!orderitem_id || !orderItemStatus) {
      return res.status(400).json({ message: 'Order item ID and order item status are required' });
    }
    if (!Object.values(OrderItemStatusType).includes(orderItemStatus)) {
      return res.status(400).json({ message: 'Invalid order item status' });
    }

    const updatedOrderItem = await orderService.updateOrderItemStatus(orderitem_id, orderItemStatus);
    if (!updatedOrderItem) {
      return res.status(404).json({ message: "Order item not found or could not be updated" });
    }
    return res.status(200).json(updatedOrderItem);
  } catch (error) {
    logger.error('Failed to update order item status:', error);
    return res.status(500).json({ message: 'An error occurred while updating order item status; please try again later' });
  }
};