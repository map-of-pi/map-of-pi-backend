import mongoose from "mongoose";
import { 
  getRollbackStockLevel, 
  getUpdatedStockLevel 
} from "../helpers/order";
import { StockValidationError } from "../errors/StockValidationError";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Seller from "../models/Seller";
import SellerItem from "../models/SellerItem";
import User from "../models/User";
import { OrderStatusType } from "../models/enums/orderStatusType";
import { OrderItemStatusType } from "../models/enums/orderItemStatusType";
import { IOrder, NewOrder } from "../types";
import { deductMappiBalance } from "./membership.service";
import logger from "../config/loggingConfig";
import { MappiDeductionError } from "../errors/MappiDeductionError";

export const createOrder = async (
  orderData: NewOrder,
): Promise<IOrder> => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Look up the seller and buyer in the database
    const seller = await Seller.findOne({ seller_id: orderData.sellerPiUid }).exec();
    const buyer = await User.findOne({ pi_uid: orderData.buyerPiUid }).exec();

    if (!buyer || !seller) {
      logger.error("Seller or buyer not found", { sellerId: orderData.sellerPiUid, buyerId: orderData.buyerPiUid });
      throw new Error("Seller or buyer not found");
    }

    /* Step 1: Create a new Order record */
    const order = new Order({
      buyer_id: buyer._id,
      seller_id: seller._id,
      payment_id: orderData.paymentId,
      total_amount: orderData.totalAmount,
      status: orderData.status,
      is_paid: false,
      is_fulfilled: false,
      fulfillment_method: orderData.fulfillmentMethod,
      seller_fulfillment_description: orderData.sellerFulfillmentDescription,
      buyer_fulfillment_description: orderData.buyerFulfillmentDescription,
    });
    const newOrder = await order.save({ session });
    if (!newOrder) throw new Error('Failed to create order');

    /* Step 2: Fetch all SellerItem documents associated with the order */
    const sellerItemIds = orderData.orderItems.map((item) => item.itemId);
    const sellerItems = await SellerItem.find({ _id: { $in: sellerItemIds } }).session(session);
    const sellerItemMap = new Map(sellerItems.map((doc) => [doc._id.toString(), doc]));

    const bulkOrderItems = [];
    const bulkSellerItemUpdates = [];

    /* Step 3: Build OrderItem documents for bulk insertion */
    for (const item of orderData.orderItems) {
      const sellerItem = sellerItemMap.get(item.itemId);
      if (!sellerItem) {
        logger.error(`Seller item not found for ID: ${item.itemId}`);
        throw new Error('Failed to find associated seller item');
      }

      // Validate and get new stock level
      const newStockLevel = getUpdatedStockLevel(sellerItem.stock_level, item.quantity, item.itemId);
      if (newStockLevel !== null) {
        bulkSellerItemUpdates.push({
          updateOne: {
            filter: { _id: sellerItem._id },
            update: { $set: { stock_level: newStockLevel } },
          },
        });
      }

      const subtotal = item.quantity * parseFloat(sellerItem.price.toString());
      bulkOrderItems.push({
        order_id: newOrder._id,
        seller_item_id: sellerItem._id,
        quantity: item.quantity,
        subtotal,
        status: OrderItemStatusType.Pending,
      });
    }

    /* Step 4: Insert order items in bulk */
    await OrderItem.insertMany(bulkOrderItems, { session });

    if (bulkSellerItemUpdates.length > 0) {
      await SellerItem.bulkWrite(bulkSellerItemUpdates, { session });
    }

    /* Step 5: Deduct single mappi for order checkout*/
    await deductMappiBalance(orderData.buyerPiUid, 1);

    /* Step 6: Commit the transaction */
    await session.commitTransaction();
    logger.info('Order and stock levels created/updated successfully', { orderId: newOrder._id });

    return newOrder;
  } catch (error: any) {
    await session.abortTransaction();

    if (error instanceof StockValidationError) {
      logger.warn(`Stock validation failed: ${error.message}`, { itemId: error.itemId });
    } else if (error instanceof MappiDeductionError) {
      logger.error(`Mappi deduction failed for PiUID: ${error.pi_uid}: ${error.message}`); 
    } else {
      logger.error(`Failed to create order and update stock: ${error}`);
    }

    throw error;
  } finally {
    session.endSession();
  }
};

export const updatePaidOrder = async (paymentId: string): Promise<IOrder> => {
  try {
    const updatedOrder = await Order.findOneAndUpdate(
      {payment_id: paymentId}, 
      { 
        $set: {
          is_paid: true,
          status: OrderStatusType.Pending
        }
      },
      { new: true }
    ).exec();
    
    if (!updatedOrder) {
      logger.error(`Failed to update paid order for payment ID ${ paymentId }`);
      throw new Error('Failed to update paid order');
    }
    return updatedOrder;

  } catch (error) {
    logger.error(`Failed to update paid order for paymentID ${ paymentId }: ${ error }`);
    throw error;
  }  
};

// TODO: To be removed once payment service is fully integrated
export const markAsPaidOrder = async (orderId: string): Promise<IOrder> => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId, 
      { 
        $set: {
          is_paid: true,
          status: OrderStatusType.Pending
        }
      },
      { new: true }
    ).exec();
    
    if (!updatedOrder) {
      logger.error(`Failed to mark as paid order for order ID ${ orderId }`);
      throw new Error('Failed to mark as paid order');
    }
    return updatedOrder;

  } catch (error) {
    logger.error(`Failed to mark as paid order for order ${ orderId }: ${ error }`);
    throw error;
  }  
};

export const getSellerOrdersById = async (
  piUid: string,
  skip: number,
  limit: number,
  status?: OrderStatusType
): Promise<{ items: IOrder[]; count: number }> => {
  try {
    const seller = await Seller.exists({ seller_id: piUid });
    if (!seller) {
      logger.warn(`Seller not found for Pi UID: ${ piUid }`);
      return { items: [], count: 0 };
    }

    const filter: any = { seller_id: seller._id, is_paid: true };
    if (status) filter.status = status;

    const [items, count] = await Promise.all([
      Order.find(filter)
        .populate('buyer_id', 'pi_username -_id')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter).exec()
    ]);

    return { items, count };
  } catch (error) {
    logger.error(`Failed to get seller orders for Pi UID ${ piUid }: ${ error }`);
    throw error;
  }
};

export const getBuyerOrdersById = async (
  piUid: string,
  skip: number,
  limit: number,
  status?: OrderStatusType
): Promise<{ items: IOrder[]; count: number }> => {
  try {
    const buyer = await User.exists({ pi_uid: piUid });
    if (!buyer) {
      logger.warn(`Buyer not found for Pi UID: ${ piUid }`);
      return { items: [], count: 0 };
    }

    const filter: any = { buyer_id: buyer._id, is_paid: true };
    if (status) filter.status = status;

    const [items, count] = await Promise.all([
      Order.find(filter)
        .populate('seller_id', 'name -_id')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter).exec()
    ]);

    return { items, count };
  } catch (error) {
    logger.error(`Failed to get buyer orders for Pi UID ${ piUid }: ${ error }`);
    throw error;
  }
};

export const deleteOrderById = async (orderId: string) => {
  try {
    const deletedOrder = await Order.findByIdAndDelete(orderId);
    if (!deletedOrder) {
      logger.error(`Order not found to delete for orderID: ${ orderId }`);
      return null;
    }
    return deletedOrder;
  } catch (error) {
    logger.error(`Failed to delete order for orderID ${ orderId }: ${ error }`);
    throw error;
  }
};

export const getOrderItems = async (orderId: string) => {
  try {
    // Fetch the base order and handle not found case
    const order = await Order.findById(orderId)
      .populate('seller_id', 'name -_id')
      .lean();
    
    if (!order) {
      logger.warn(`Order items not found for orderID: ${ orderId }`);
      return null; // Order not found
    }

    // Fetch the user's pi_username based on buyer_id matching pi_uid
    const user = await User.findById(order.buyer_id, "pi_username");

    // Fetch the items linked to the order
    const orderItems = await OrderItem.find({ order_id: orderId })
      .populate({ path: "seller_item_id", model: "Seller-Item" })
      .lean();

    logger.info(`Fetched ${ orderItems.length } order items for orderID ${ orderId }`);
    
    const result = orderItems.map(item => ({
      ...item,
      seller_item: item.seller_item_id,
    }));

    return { 
      order, 
      orderItems: result, 
      pi_username: user?.pi_username || '',  
    };
  } catch (error) {
    logger.error(`Failed to get order items for orderID ${ orderId }: ${ error }`);
    throw error;
  }
};

export const updateOrderStatus = async (
  orderId: string, 
  orderStatus: OrderStatusType
) => {
  try {
    // Handle specific order statuses
    if (orderStatus === OrderStatusType.Completed) {
      const orderItems = await OrderItem.find({ order_id: orderId }).exec();

      if (orderItems.length > 0) {
        await OrderItem.updateMany(
          { _id: { $in: orderItems.map(item => item._id) } },
          { status: OrderItemStatusType.Fulfilled }
        ).exec();
        logger.info(`Marked ${ orderItems.length } order items as fulfilled for orderID ${ orderId }`);
      } else {
        logger.warn(`No order items found to mark as fulfilled for orderID ${ orderId }`);
      }
    } else {
      logger.warn(`Unhandled order status type: ${ orderStatus } for orderID ${ orderId }`);
    }

    // Update the main order status
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId, 
      { status: orderStatus },
      { new: true }
    ).exec();

    if (!updatedOrder) {
      logger.error(`Order not found or failed to update status for orderID ${ orderId }`);
      return null;
    }

    return updatedOrder;
  } catch (error) {
    logger.error(`Failed to update order status for orderID ${ orderId }: ${ error }`);
    throw error;
  }  
};

export const updateOrderItemStatus = async (
  itemId: string, 
  itemStatus: string
) => {
  try {
    const updatedItem = await OrderItem.findByIdAndUpdate(
      itemId, 
      { status: itemStatus }, 
      { new: true }
    ).exec();

    if (!updatedItem) {
      logger.error(`Order item not found or failed to update for itemId: ${ itemId }`);
      return null;
    }

    logger.info(`Order item ${ itemId } updated to status "${ itemStatus }"`);
    return updatedItem;
  } catch (error) {
    logger.error(`Failed to update order item status for orderItemID ${ itemId }: ${ error }`);
    throw error;
  }
}

export const cancelOrder = async (paymentId: string) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    /* Step 1: Cancel the order */
    const cancelledOrder = await Order.findOneAndUpdate(
      { payment_id: paymentId },
      {
        is_paid: false,
        status: OrderStatusType.Cancelled,
      },
      { new: true, session }
    );

    if (!cancelledOrder) {
      logger.error(`Failed to cancel order for paymentID ${paymentId}`);
      throw new Error('Failed to cancel order');
    }

    /* Step 2: Get order items */
    const orderItems = await OrderItem.find({
      order_id: cancelledOrder._id,
      status: OrderItemStatusType.Pending,
    }).session(session);

    if (orderItems.length === 0) {
      logger.warn(`No pending order items found for order ${cancelledOrder._id}`);
    }

    /* Step 3: Get related seller items */
    const sellerItemIds = orderItems.map((item) => item.seller_item_id);
    const sellerItems = await SellerItem.find({ _id: { $in: sellerItemIds } }).session(session);
    const sellerItemMap = new Map(sellerItems.map((item) => [item._id.toString(), item]));

    const bulkSellerItemUpdates = []; 
    
    for (const item of orderItems) {
      const sellerItem = sellerItemMap.get(item.seller_item_id.toString());
      if (!sellerItem) continue;

      const restoredLevel = getRollbackStockLevel(sellerItem.stock_level, item.quantity);
      if (restoredLevel !== null) {
        bulkSellerItemUpdates.push({
          updateOne: {
            filter: { _id: sellerItem._id },
            update: { $set: { stock_level: restoredLevel } },
          },
        });
      }
    }

    if (bulkSellerItemUpdates.length > 0) {
      await SellerItem.bulkWrite(bulkSellerItemUpdates, { session });
    }

    await session.commitTransaction();
    logger.info(`Order with paymentID ${paymentId} successfully cancelled and stock levels restored.`);
    return cancelledOrder;
  } catch (error: any) {
    await session.abortTransaction();
    logger.error(`Failed to cancel order for paymentID ${paymentId}: ${error.message}`);
    throw error;
  } finally {
    session.endSession();
  }
};