import mongoose, { Schema } from "mongoose";
import { INotification } from "../types";

const notificationSchema = new Schema<INotification>(
  {
    pi_uid: {
      type: String,
      required: true,
    },
    is_cleared: {
      type: Boolean,
      required: true,
      default: false,
    },
    reason: {
      type: String,
      required: true,
    },
    // createdAt: {
    //     type: Date,
    //     default: Date.now,
    // },
    // updatedAt: {
    //     type: Date,
    //     default: Date.now,
    // },
  },
  { timestamps: true }
);

const Notification = mongoose.model<INotification>("Notification", notificationSchema);

export default Notification;