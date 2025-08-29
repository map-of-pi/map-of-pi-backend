import axios from 'axios';
import { platformAPIClient } from '../config/platformAPIclient';
import logger from '../config/loggingConfig';
import { FulfillmentType } from '../models/enums/fulfillmentType';
import { MembershipClassType, MappiCreditType } from "../models/enums/membershipClassType";
import { OrderStatusType } from '../models/enums/orderStatusType';
import { PaymentType } from "../models/enums/paymentType";
import { 
  cancelOrder, 
  createOrder, 
  updatePaidOrder 
} from '../services/order.service';
import { 
  getPayment, 
  createPayment, 
  completePayment, 
  cancelPayment
} from '../services/payment.service';
import { applyMembershipChange } from "../services/membership.service";
import { PaymentDTO, PaymentInfo, U2AMetadata } from '../types';

const logPlatformApiError = (error: any, context: string) => {
  if (error.response) {
    logger.error(`${context} - platformAPIClient error`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response.status,
      data: error.response.data,
    });
  } else {
    logger.error(`${context} - Unhandled error`, {
      message: error.message,
      stack: error.stack,
    });
  }
};

const buildPaymentData = (currentPayment: PaymentDTO) => {
  const paymentMetadata = currentPayment.metadata as U2AMetadata;
  return {
    piPaymentId: currentPayment.identifier,
    buyerPiUid: currentPayment.user_uid as string,
    memo: currentPayment.memo,
    amount: currentPayment.amount,
    paymentType: paymentMetadata.payment_type
  };
};

/**
 * Handle existing otherwise build new payment record
 */
const buildPaymentRecord = async (
  currentPayment: PaymentDTO
): Promise<{ isExisting: boolean; paymentId?: string }> => {
  const piPaymentId = currentPayment.identifier;
  const existingPayment = await getPayment(piPaymentId);

  // Check if a payment record with this ID already exists in the database
  if (existingPayment) {
    logger.info("Payment record already exists: ", existingPayment._id);
    await processPaymentError(currentPayment);
    return { isExisting: true };
  }

  // Create a new payment record
  const newPaymentData = buildPaymentData(currentPayment);
  const newPayment = await createPayment(newPaymentData);
  // Validate payment record creation succeeded
  if (!newPayment) {
    logger.error("Unable to create payment record");
    throw new Error("Unable to create payment record");
  }

  return { isExisting: false, paymentId: newPayment._id as string };
};

/**
 * Create an order from payment metadata
 */
const checkoutProcess = async (currentPayment: PaymentDTO, paymentId: string) => {
  const paymentMetadata = currentPayment.metadata as U2AMetadata;
  const OrderMetadata = paymentMetadata.OrderPayment;

  // Ensure order items are present
  if (!OrderMetadata?.items) {
    logger.error("Order items not found in OrderPayment metadata");
    throw new Error("Order items not found in OrderPayment metadata");
  }

  // Construct order data object
  const newOrderData = {
    buyerPiUid: OrderMetadata.buyer as string,
    sellerPiUid: OrderMetadata.seller as string,
    paymentId: paymentId, // objectId of the Payment schema
    totalAmount: currentPayment.amount.toString(),
    orderItems: OrderMetadata.items,
    status: OrderStatusType.Initialized,
    fulfillmentMethod: OrderMetadata.fulfillment_method as FulfillmentType,
    sellerFulfillmentDescription: OrderMetadata.seller_fulfillment_description as string,
    buyerFulfillmentDescription: OrderMetadata.buyer_fulfillment_description as string,
  }
  // Create a new order along with its items
  const newOrder = await createOrder(newOrderData);

  logger.info('order created successfully', { orderId: newOrder._id });
  return newOrder;
}

/**
 * Complete a Pi payment (U2A) in both DB and blockchain
 */
const completePiPayment = async (piPaymentId: string, txid: string) => {
  const res = await platformAPIClient.get(`/v2/payments/${ piPaymentId }`);
  const currentPayment: PaymentDTO = res.data;
  const userPiUid = currentPayment.user_uid;

  if (!txid) {
    logger.warn("No transaction ID");
    throw new Error("No transaction ID");
  }
  
  // Mark the payment as completed
  const completedPayment = await completePayment(piPaymentId, txid);
  logger.info("Payment record marked as completed");

  if (completedPayment?.payment_type === PaymentType.BuyerCheckout) {
    // Update the associated order's status to paid
    await updatePaidOrder(completedPayment._id as string);
    logger.info("Order record updated to paid");
  } else if (completedPayment?.payment_type === PaymentType.Membership) {
    const paymentMetadata = currentPayment.metadata as U2AMetadata
    const membershipClass = paymentMetadata.MembershipPayment?.membership_class as MembershipClassType | MappiCreditType
    await applyMembershipChange(userPiUid, membershipClass);
    logger.info("Membership subscription updated successfully");
  }

  // Notify Pi Platform of successful completion
  const completedPiPayment = await platformAPIClient.post(`/v2/payments/${ piPaymentId }/complete`, { txid });      
  if (completedPiPayment.status !== 200) {
    logger.error("Failed to mark U2A payment completed on Pi blockchain")
    throw new Error("Failed to mark U2A payment completed on Pi blockchain");
  }

  logger.info("Payment marked completed on Pi blockchain", completedPiPayment.status);
  return completedPiPayment;
};

/**
 * Process incomplete payment
 */
export const processIncompletePayment = async (payment: PaymentInfo) => {
  try {
    const piPaymentId = payment.identifier;
    const txid = payment.transaction?.txid;
    const txURL = payment.transaction?._link;

    // Retrieve the original (incomplete) payment record by its identifier
    const incompletePayment = await getPayment(piPaymentId);
    if (!incompletePayment) {
      logger.warn("No incomplete payment record found");
      throw new Error("Finding incomplete payment failed");
    }

    // Fetch the payment memo from the Pi Blockchain via Horizon API
    const horizonResponse = await axios.create({ timeout: 20000 }).get(txURL!);
    const blockchainMemo = horizonResponse.data.memo;
    logger.info("paymentIdOnBlock: ", blockchainMemo);

    // Validate that the memo from the blockchain matches the expected payment ID
    if (blockchainMemo !== incompletePayment.pi_payment_id) {
      throw new Error("Unable to find payment on the Pi Blockchain");
    }

    await completePiPayment(piPaymentId, txid as string);

    return {
      success: true,
      message: `Payment completed from incomplete payment with id ${ piPaymentId }`,
    };
  } catch (error: any) {
    logPlatformApiError(error, "processIncompletePayment");
    throw(error);
  }
};

/**
 * Approve payment
 */
export const processPaymentApproval = async (
  paymentId: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    // Fetch payment details from the Pi platform using the payment ID
    const res = await platformAPIClient.get(`/v2/payments/${ paymentId }`);
    const currentPayment: PaymentDTO = res.data;
    const paymentMetadata = currentPayment.metadata as U2AMetadata

    const { isExisting, paymentId: newPaymentId } = 
      await buildPaymentRecord(currentPayment);

    if (isExisting) {
      return {
        success: false,
        message: `Payment already exists with ID ${currentPayment.identifier}`,
      };
    }

    // Handle logic based on the payment type
    if (paymentMetadata.payment_type === PaymentType.BuyerCheckout) {
      const newOrder = await checkoutProcess(currentPayment, newPaymentId!);
      logger.info("Order created successfully: ", newOrder._id);
    }

    // Approve the payment on the Pi platform
    await platformAPIClient.post(`/v2/payments/${ currentPayment.identifier }/approve`);

    return {
      success: true,
      message: `Payment approved with id ${ currentPayment.identifier }`,
    };
  } catch (error: any) {
    logPlatformApiError(error, "processPaymentApproval");
    throw(error);
  }
};

/**
 * Complete payment
 */
export const processPaymentCompletion = async (
  paymentId: string, 
  txid: string
) => {
  try {
    // Confirm the payment exists via Pi platform API
    await completePiPayment(paymentId, txid);
    return {
      success: true,
      message: `U2A Payment completed with id ${ paymentId }`,
    };
  } catch (error: any) {
    logPlatformApiError(error, "processPaymentCompletion");
    throw(error);
  }
}; 

/**
 * Cancel payment
 */
export const processPaymentCancellation = async (paymentId: string) => {
  try {
    // Mark the payment as cancelled
    const cancelledPayment = await cancelPayment(paymentId);
    if (!cancelledPayment) {
      throw new Error(`No payment found with id ${ paymentId }`);
    }

    // Perform cancellation logic based on the type of payment
    if (cancelledPayment.payment_type === PaymentType.BuyerCheckout) {
      // Cancel the related order
      await cancelOrder(cancelledPayment._id as string);
      logger.info('Order record updated to cancelled');
    } else if (cancelledPayment.payment_type === PaymentType.Membership) {
      logger.info('Membership subscription cancelled');
    }

    // Notify the Pi platform that the payment has been cancelled
    await platformAPIClient.post(`/v2/payments/${ paymentId }/cancel`);
    logger.info('Successfully posted cancellation to Pi platform');

    return {
      success: true,
      message: `Payment cancelled with id ${ paymentId }`,
    };
  } catch (error: any) {
    logPlatformApiError(error, "processPaymentCancellation");
    throw(error);
  }
};

/**
 * Handle payment error
 */
export const processPaymentError = async (paymentDTO: PaymentDTO) => {
  try {
    // handle existing payment
    const transaction = paymentDTO.transaction;
    const paymentId = paymentDTO.identifier;

    if (transaction) {        
      const PaymentData = {
        identifier: paymentId,
        transaction: {
          txid: transaction.txid,
          _link: transaction._link,
        }
      };
      await processIncompletePayment(PaymentData);
      return {
        success: true,
        message: `Payment Error with ID ${paymentId} handled and completed successfully`,
      };
    } else {
      logger.warn("No transaction data found for existing payment");
      await processPaymentCancellation(paymentId);
      return {
        success: true,
        message: `Payment Error with ID ${paymentId} cancelled successfully`,
      };
    }
  } catch (error: any) {
    logPlatformApiError(error, "processPaymentError");
    throw(error);
  }
};