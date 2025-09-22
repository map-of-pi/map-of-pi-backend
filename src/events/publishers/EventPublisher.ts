import {EventEmitter} from "node:events";
import {EventHandlerManager} from "../handlers/EventHandlerManager";
import {IEvent} from "../NotificationEvent";
import logger from "../../config/loggingConfig";

export class EventPublisher<TEvent extends IEvent>{
  private emitter = new Emitter();
  async publish(event: TEvent) {
    logger.info(`Publishing event: ${event.type}`);
    const result = this.emitter.emit('dispatchEvent', event);
    logger.info(`Event published: ${result}`);
  }
}

class Emitter extends EventEmitter {
  constructor() {
    super();
    this.setupListeners();
  }

  private setupListeners() {
    this.on("dispatchEvent", async (event) => {
      const handlerRegistry = EventHandlerManager.getInstance();
      await handlerRegistry.handleEvent(event);
    });
  }
}