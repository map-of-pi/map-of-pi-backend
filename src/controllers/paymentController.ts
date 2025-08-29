import { Request, Response } from "express";
import logger from "../config/loggingConfig";
import { 
  processIncompletePayment, 
  processPaymentApproval, 
  processPaymentCancellation, 
  processPaymentCompletion,
  processPaymentError
} from "../helpers/payment";

export const onIncompletePaymentFound = async (req: Request, res: Response) => {
 const { payment } = req.body;

  try {
    const processedPayment = await processIncompletePayment(payment);
    return res.status(200).json(processedPayment);
  } catch (error) {
    logger.error(`Failed to process incomplete payment for paymentID ${ payment.identifier }:`, error);
    return res.status(500).json({ 
      success: false,
      message: 'An error occurred while processing incomplete payment; please try again later' 
    });
  }
};

export const onPaymentApproval = async (req: Request, res: Response) => {
  const { paymentId } = req.body;
  try {
    const approvedPayment = await processPaymentApproval(paymentId);
    return res.status(200).json(approvedPayment);
  } catch (error) {
    logger.error(`Failed to approve Pi payment for paymentID ${ paymentId }:`, error);
    return res.status(500).json({
      success: false, 
      message: 'An error occurred while approving Pi payment; please try again later' 
    });
  }
};

export const onPaymentCompletion = async (req: Request, res: Response) => {
  const { paymentId, txid } = req.body;
  try {
    const completedPayment = await processPaymentCompletion(paymentId, txid);
    return res.status(200).json(completedPayment);
  } catch (error) {
    logger.error(`Failed to complete Pi payment for paymentID ${ paymentId } | txID ${ txid }:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while completing Pi payment; please try again later',
    });
  }
};

export const onPaymentCancellation = async (req: Request, res: Response) => {
  const { paymentId } = req.body;
  try {
    const cancelledPayment = await processPaymentCancellation(paymentId);
    return res.status(200).json(cancelledPayment);
  } catch (error) {
    logger.error(`Failed to cancel Pi payment for paymentID ${ paymentId }:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while cancelling Pi payment; please try again later',
    });
  }
};

export const onPaymentError = async (req: Request, res: Response) => {
  const { paymentDTO, error } = req.body;
  logger.error(`Received payment error callback from Pi:`, error);
  
  if (!paymentDTO) {
    return res.status(400).json({
      success: true,
      message: `No Payment data provided for the error: ${ error }`
    })
  }

  try {
    const erroredPayment = await processPaymentError(paymentDTO);
    return res.status(200).json(erroredPayment);
  } catch (error_) {
    logger.error(`Failed to process payment error`, error_);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while erroring Pi payment; please try again later' 
    });
  } 
};