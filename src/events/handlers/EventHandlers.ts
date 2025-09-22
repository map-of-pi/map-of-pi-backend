import {IEventHandler} from "./IEventHandler";
import Notification from "../../models/Notification";
import {addNotification} from "../../services/notification.service";
import logger from "../../config/loggingConfig";
import {IEvent} from "../NotificationEvent";

export class SanctionEventHandler implements IEventHandler {
  async handle(event: IEvent): Promise<void> {
    try {
      await addNotification(
        event.payload.seller_id,
        event.payload.isRestricted
          ? 'Your Sell Center is in a Pi Network sanctioned area, so your map marker will no longer appear in searches.'
          : 'Your Sell Center is no longer in a Pi Network sanctioned area, so your map marker will now be visible in searches.',
      );
      // add success notification event;
    } catch (e) {
      logger.warning(`failed to add notification for user ${event.payload.seller_id}`)
      // add notification event;
    }
  }

  supports(event: IEvent): Promise<boolean> {
    return Promise.resolve(event.type === "sanction.event");
  }
}



class OrderEventHandler implements IEventHandler {
  async handle(event: IEvent): Promise<void> {
    try {
      const notification = await addNotification(event.payload.pi_uid, event.payload.reason);

    } catch (e) {
      logger.warning(`failed to add notification for user ${event.payload.pi_uid}`)
      // add notification event;
    }
  }

  supports(event: IEvent): Promise<boolean> {
    return Promise.resolve(event.type === "order.created");
  }
}
