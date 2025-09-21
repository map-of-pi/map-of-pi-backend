import {agenda} from "../../utils/agenda";
import {EventHandlerManager} from "../../events/handlers/EventHandlerManager";

agenda.define("dispatchEvent", async (job) => {
  const {event} = job.attrs.data as { event: IEvent };
  const handlerRegistry = EventHandlerManager.getInstance();
  await handlerRegistry.handleEvent(event);
});