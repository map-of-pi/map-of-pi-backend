import mongoose, { Schema, SchemaTypes } from "mongoose";
import { U2UPaymentStatus } from "./enums/u2uPaymentStatus";
import { IPaymentCrossReference } from "../types";

const paymentCrossReferenceSchema = new Schema<IPaymentCrossReference>(
  {
    order_id: {
      type: SchemaTypes.ObjectId,
      require: true,
      unique: true,
      ref: "Order"
    },
    u2a_payment_id: {
      type: SchemaTypes.ObjectId,
      required: true,
      default: null,
      ref: "Payment",
    },
    a2u_payment_id: {
      type: SchemaTypes.ObjectId,
      required: false,
      default: null,
      ref: "Payment",
    },
    u2u_status: {
      type: String,
      enum: Object.values(U2UPaymentStatus).filter(value => typeof value === 'string'),
      required: true,
      default: U2UPaymentStatus.Pending,
    },
    error_message: {
      type: String,
      required: false,
      default: '',
    },
    u2a_completed_at: {
      type: Date,
      required: false,
    },
    a2u_completed_at: {
      type: Date,
      required: false,
    },
  }, {timestamps: true} // Adds timestamps to track creation and update times
);

const PaymentCrossReference = mongoose.model<IPaymentCrossReference>("PaymentXRef", paymentCrossReferenceSchema);

export default PaymentCrossReference;