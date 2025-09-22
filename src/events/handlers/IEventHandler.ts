import {IEvent} from "../NotificationEvent";

export interface IEventHandler<T extends IEvent = IEvent> {
  supports(event: T): Promise<boolean>;

  handle(event: T): Promise<void>;
}