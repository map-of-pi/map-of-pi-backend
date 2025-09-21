import {IEventHandler} from "./IEventHandler";
import Notification from "../../models/Notification";
import {addNotification} from "../../services/notification.service";
import logger from "../../config/loggingConfig";

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