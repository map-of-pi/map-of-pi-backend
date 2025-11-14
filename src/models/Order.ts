import mongoose, { Schema, SchemaTypes, Types } from "mongoose";

import { FulfillmentType } from "./enums/fulfillmentType";
import { OrderStatusType } from "./enums/orderStatusType";
import { IOrder } from "../types";

const orderSchema = new Schema<IOrder>(
  {
    payment_id: {
      type: SchemaTypes.ObjectId,
      required: false, // To change to true once payment integration is complete
      default: null,
      ref: "Payment",
    },
    buyer_id: {
      type: SchemaTypes.ObjectId,
      required: true,
      ref: "User",
    },
    seller_id: {
      type: SchemaTypes.ObjectId,
      required: true,
      ref: "Seller",
    },
    total_amount: {
      type: Types.Decimal128,
      required: true,
      default: 0.00
    },
    is_paid: {
      type: Boolean,
      default: false,
      required: true
    },
    is_fulfilled: {
      type: Boolean,
      default: false,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(OrderStatusType).filter(value => typeof value === 'string'),
      required: true,
      default: OrderStatusType.Pending,
    },
    fulfillment_type: {
      type: String,
      enum: Object.values(FulfillmentType).filter(value => typeof value === 'string'),
      default: FulfillmentType.CollectionByBuyer
    },
    buyer_fulfillment_description: {
      type: String,
      required: false,
      default: ""
    }, 
    seller_fulfillment_description: {
      type: String,
      required: false,
      default: ""
    }
  },
  { timestamps: true } // Adds timestamps to track creation and update times
);

// Creating the Order model from the schema
const Order = mongoose.model<IOrder>("Order", orderSchema);

export default Order;
