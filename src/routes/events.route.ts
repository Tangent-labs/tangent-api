import { FastifyInstance, FastifyRequest } from "fastify";
import { getEventsByAccount } from "../data/events.data";
import { transformEvents } from "../services/events.service";
import { eventsSchema } from "./shemas";
import { EventsRoute } from "../types";

export async function registerEventsRoute(fastify: FastifyInstance) {
  fastify.get<EventsRoute>(
    "/events/:account/:market",
    eventsSchema,
    async (request: FastifyRequest<EventsRoute>, reply) => {
      try {
        const { account, market } = request.params;
        const rawEvents = await getEventsByAccount(fastify, account, market);
        const transformedEvents = transformEvents(rawEvents);
        fastify.log.info(
          `Query returned ${
            transformedEvents.length
          } rows for account ${account}: ${JSON.stringify(transformedEvents)}`
        );
        return transformedEvents;
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Failed to fetch events" });
      }
    }
  );
}
