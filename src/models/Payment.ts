import mongoose, { Schema, SchemaTypes, Types } from "mongoose";

import { IPayment } from "../types";
import { PaymentType } from "./enums/paymentType";

const paymentSchema = new Schema<IPayment>(
  {
    user_id: {
      type: SchemaTypes.ObjectId,
      required: true,
      ref: "User"
    },
    pi_payment_id: {
      type: String,
      required: true,
      unique: true,
      default: null
    },
    txid: {
      type: String,
      required: false
    },
    amount: {
      type: Types.Decimal128,
      required: true,
      default: 0.00
    },
    paid: {
      type: Boolean,
      default: false,
      required: true
    },
    cancelled: {
      type: Boolean,
      default: false,
      required: true
    },
    memo: {
      type: String,
      required: false,
      default: ""
    },
    payment_type: {
      type: String,
      enum: Object.values(PaymentType).filter(value => typeof value === 'string'),
      required: true,
      default: PaymentType.BuyerCheckout,
    }
  }, { timestamps: true } // Adds timestamps to track creation and update times
);

// Creating a partial index to enforce uniqueness if txid is a string 
paymentSchema.index({ txid: 1 }, {
  unique: true,
  partialFilterExpression: { txid: { $type: "string" } }
});

// Creating the Payment model from the schema
const Payment = mongoose.model<IPayment>("Payment", paymentSchema);

export default Payment;
