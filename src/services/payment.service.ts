import axios from "axios";
import pi from "../config/platformAPIclient";
import Payment from "../models/Payment";
import User from "../models/User";
import PaymentCrossReference from "../models/PaymentCrossReference";
import { U2UPaymentStatus } from "../models/enums/u2uPaymentStatus";
import { 
  IPayment, 
  IPaymentCrossReference, 
  NewPayment, 
  U2URefDataType,
} from "../types";
import logger from "../config/loggingConfig";

export const createPayment = async (paymentData: NewPayment): Promise<IPayment> => {
  try {    

    const user = await User.findOne({pi_uid: paymentData.buyerPiUid}).exec()
    // Create new payment
    const payment = new Payment({
      pi_payment_id: paymentData.piPaymentId,
      user_id: user?._id,
      amount: paymentData.amount,
      paid: false,
      memo: paymentData.memo,
      payment_type: paymentData.paymentType,
      cancelled: false,
    });

    return await payment.save();

  } catch (error: any) {
    logger.error(`Failed to create payment for piPaymentID ${ paymentData.piPaymentId }: ${ error }`);
    throw error;
  }
};

export const createPaymentCrossReference = async (
  refData: U2URefDataType
): Promise<IPaymentCrossReference> => {
  try {
    const newRef = new PaymentCrossReference({
      order_id: refData.orderId,
      u2a_payment_id: refData.u2aPaymentId,
      u2a_completed_at: new Date(),
      a2u_payment_id: null
    });

    return await newRef.save();
  } catch (error: any) {
    logger.error(`Failed to create Payment xRef for orderID ${ refData.orderId }: ${ error }`);
    throw error;
  }
};

export const updatePaymentCrossReference = async (
  refData: U2URefDataType
): Promise<IPaymentCrossReference> => {
  try {
    const updatedRef = await PaymentCrossReference.findOneAndUpdate(
      { order_id: refData.orderId },
      {
        a2u_payment_id: refData.a2uPaymentId,
        a2u_completed_at: new Date(),
        u2u_status: refData.u2uStatus
      },
      { new: true }
    ).lean().exec();

    if (!updatedRef) {
      logger.error(`No Payment xRef found to update for orderID ${ refData.orderId }`);
      throw new Error('No Payment xRef found to update');
    }
    return updatedRef;
  } catch (error: any) {
    logger.error(`Failed to update Payment xRef for orderID ${ refData.orderId }: ${ error }`);
    throw error;
  }
};

export const getPayment = async (piPaymentId: string): Promise<IPayment | null> => {
  try {
    const existingPayment = await Payment.findOne({ pi_payment_id: piPaymentId }).exec();
    if (!existingPayment) {
      logger.warn(`Failed to get payment; no record found for piPaymentID ${ piPaymentId }`);
      return null;
    }
    return existingPayment;

  } catch (error: any) {
    logger.error(`Failed to get payment for piPaymentID ${ piPaymentId }: ${ error }`);
    throw error;
  }
};

export const getIncompleteServerPayments = async (): Promise<any> => {
  try {
    const serverPayments = await pi.getIncompleteServerPayments();
    if (!serverPayments || serverPayments.length === 0) { 
      logger.info('No incomplete Pi payments found on the server');
      return [];
    }
    logger.info(`Found ${ serverPayments.length } incomplete Pi payments on the server`, serverPayments);
    return serverPayments;
  } catch (error: any) {
    logger.error(`Failed to fetch incomplete Pi payments from server: ${ error.message }`);
    throw error;
  }
};

export const completePayment = async (
  piPaymentId: string, 
  txid: string
): Promise<IPayment> => {
  try {
    const updatedPayment = await Payment.findOneAndUpdate(
      { pi_payment_id: piPaymentId }, 
      { $set: { txid, paid: true } }, 
      { new: true }
    ).exec();

    if (!updatedPayment) {
      logger.error(`Failed to update payment record for piPaymentID ${ piPaymentId }`);
      throw new Error('Failed to update payment');
    }
    return updatedPayment;
    
  } catch (error: any) {
    logger.error(`Failed to complete payment for piPaymentID ${ piPaymentId }: ${ error }`);
    throw error;
  }
};

export const completeServerPayment = async (): Promise<void> => {
  const {incomplete_server_payments} = await getIncompleteServerPayments();
  logger.info("Found incomplete server payments", incomplete_server_payments);
  if (!incomplete_server_payments || incomplete_server_payments.length === 0) {
    logger.warn('No incomplete server payment');
  }

  for (const payment of incomplete_server_payments) {
    let transaction = payment.transaction || null;
    const piPaymentId = payment.identifier;
    const metadata = payment.metadata as { orderId: string; sellerId: string; buyerId: string };

    if (!piPaymentId) {
      logger.error(`Missing Pi payment ID for payment: ${JSON.stringify(payment)}`);
      continue;
    }

    try {
      let txid = transaction?.txid;

      // Submit payment if txid not yet assigned
      if (!txid) {
        txid = await pi.submitPayment(piPaymentId);
        if (!txid) {
          throw new Error(`Failed to submit Pi payment with ID ${piPaymentId}`);
        }
      }

      // Mark the payment as completed in your DB
      const updatedPayment = await completePayment(piPaymentId, txid);
      if (!updatedPayment) {
        throw new Error(`Failed to update payment DB for payment ID ${piPaymentId}`);
      }
      logger.info(`Marked A2U payment as completed for ${piPaymentId}`);

      // Update U2U payment cross reference
      const u2uRef = await updatePaymentCrossReference({
        orderId: metadata?.orderId,
        u2uStatus: U2UPaymentStatus.A2UCompleted,
        a2uPaymentId: updatedPayment._id as string,
      });

      if (!u2uRef) {
        throw new Error(`Failed to update payment cross reference for order ${metadata.orderId}`);
      }

      logger.info('Updated U2U reference record', u2uRef);

      // Final confirmation with Pi network
      const completedPiPayment = await pi.completePayment(piPaymentId, txid);
      if (!completedPiPayment) {
        throw new Error(`Failed to confirm Pi payment on blockchain for ${piPaymentId}`);
      }

      logger.info(`✅ A2U payment process completed for Order ID: ${metadata.orderId}`);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        logger.error(`Axios error during A2U payment for order ${metadata.orderId || 'unknown'}: ${error.message}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
      } else {
        logger.error(`❌ Error completing server payment for Order ID ${metadata.orderId || 'unknown'}: ${error.message}`);
      }
    }
  }
};

export const cancelPayment = async (piPaymentId: string): Promise<IPayment | null> => {
  try {
    const cancelledPayment = await Payment.findOneAndUpdate(
      { pi_payment_id: piPaymentId }, 
      { $set: { cancelled: true, paid: false } }, 
      { new:true }
    ).exec();

    if (!cancelledPayment) {
      logger.error(`Failed to cancel payment record for piPaymentID ${ piPaymentId }`);
      throw new Error('Failed to cancel payment');
    }
    return cancelledPayment;

  } catch (error: any) {
    logger.error(`Failed to cancel payment for piPaymentID ${ piPaymentId }: ${ error }`);
    throw error;
  }
};