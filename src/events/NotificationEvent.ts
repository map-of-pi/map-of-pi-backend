export interface IEvent {
  type: string;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}