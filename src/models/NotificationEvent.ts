import mongoose, { Schema } from "mongoose";
import {INotification, INotificationEvent} from "../types";

const notificationEventSchema = new Schema<INotificationEvent>(
  {
    notification_id: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    retry_count: {
      type: Number,
      required: true,
      default: 0,
    },
    reason: {
      type: String,
      required: true,
    },
    error_message: {
      type: String,
      required: true,
    }
  },
  { timestamps: true }
);

const NotificationEvent = mongoose.model<INotificationEvent>("NotificationEvent", notificationEventSchema);

export default NotificationEvent;