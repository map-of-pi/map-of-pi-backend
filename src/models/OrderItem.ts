import mongoose, { Schema, SchemaTypes, Types } from "mongoose";

import { OrderItemStatusType } from "./enums/orderItemStatusType";
import { IOrderItem } from "../types";

const orderItemSchema = new Schema<IOrderItem>(
  {
    order_id: {
      type: SchemaTypes.ObjectId,
      required: true,
      ref: "Order",
    },
    seller_item_id: {
      type: SchemaTypes.ObjectId,
      required: true,
      ref: "Seller-Item", 
    },
    quantity: {
      type: Number,
      required: true,
      default: 0
    },
    subtotal: {
      type: Types.Decimal128,
      required: true,
      default: 0.00
    },
    status: {
      type: String,
      enum: Object.values(OrderItemStatusType).filter(value => typeof value === 'string'),
      required: true,
      default: OrderItemStatusType.Pending,
    },
  },
  { timestamps: true } // Adds timestamps to track creation and update times
);

// Creating the OrderItem model from the schema
const OrderItem = mongoose.model<IOrderItem>("OrderItem", orderItemSchema);

export default OrderItem;
