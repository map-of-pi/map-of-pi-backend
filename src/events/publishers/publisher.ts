import {agenda} from "../../utils/agenda";

export class Publisher<TEvent extends IEvent> {
  async publish(event: TEvent) {
    await agenda.now("dispatchEvent", {event});
  }
}