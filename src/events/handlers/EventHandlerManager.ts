import {IEventHandler} from "./IEventHandler";
import logger from "../../config/loggingConfig";
import {IEvent} from "../NotificationEvent";
import {SanctionEventHandler} from "./EventHandlers";

export class EventHandlerManager {
  private static instance: EventHandlerManager;
  private handlers = new Set<IEventHandler>();

  // Private constructor ensures no external instantiation
  private constructor() {
    this.handlers.add(new SanctionEventHandler())
  }

  // Singleton accessor
  public static getInstance(): EventHandlerManager {
    if (!EventHandlerManager.instance) {
      EventHandlerManager.instance = new EventHandlerManager();
    }
    return EventHandlerManager.instance;
  }

  public async handleEvent(event: IEvent){
    for (const handler of this.getHandlers(event)) {
      logger.info(`Handling event ${event.type}`);
      try {
        await handler.handle(event)
      } catch (e) {
        logger.warn(`Error handling event ${event.type}:`, e);
      }
    }
  }

  public register(handler: IEventHandler) {
    this.handlers.add(handler);
  }

  private getHandlers(event: IEvent) {
    return [...this.handlers].filter(handler => handler.supports(event));
  }
}


