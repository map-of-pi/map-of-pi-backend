import { Router } from "express";
import { 
  onIncompletePaymentFound, 
  onPaymentApproval, 
  onPaymentCancellation, 
  onPaymentCompletion,
  onPaymentError
} from "../controllers/paymentController";

const paymentsRouter = Router();

paymentsRouter.post("/incomplete", onIncompletePaymentFound);
paymentsRouter.post("/complete", onPaymentCompletion);
paymentsRouter.post("/approve", onPaymentApproval);
paymentsRouter.post("/cancelled-payment", onPaymentCancellation);
paymentsRouter.post("/error", onPaymentError);

export default paymentsRouter;