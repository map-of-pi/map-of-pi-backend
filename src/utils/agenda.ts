import {Agenda} from "@hokify/agenda";

export const agenda = new Agenda({
  db: {address: process.env.MONGODB_URL!, collection: "agendaJobs"},
  processEvery: "1 hour",
  maxConcurrency: 20
});