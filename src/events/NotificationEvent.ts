interface IEvent {
  type: string;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

class NotificationEvent implements IEvent {
  type: string;
  payload: Record<string, any>;

  constructor(type: string, payload: Record<string, any>) {
    this.type = type;
    this.payload = payload;
  }
}