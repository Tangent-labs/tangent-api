import { FastifyInstance, FastifyRequest } from "fastify"
import { EventRepository } from "../data/events.data"
import { getMarketHistoricalData, transformEvents } from "../services/events.service"
import { eventsSchema } from "./shemas"
import { EventsRoute, GetHistoricalMarketDataParamsRoute } from "../types"

export async function registerEventsRoute(fastify: FastifyInstance, opts: { eventRepository: EventRepository }) {
  fastify.get<EventsRoute>("/events/:account/:market", eventsSchema, async (request: FastifyRequest<EventsRoute>, reply) => {
    try {
      const { account, market } = request.params
      const rawEvents = await opts.eventRepository.getEventsByAccount(account, market)
      const transformedEvents = transformEvents(rawEvents)
      fastify.log.info(`Query returned ${transformedEvents.length} rows for account ${account}: ${JSON.stringify(transformedEvents)}`)
      return transformedEvents
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch events" })
    }
  })

  // TODO Need to add a schema
  fastify.get("/markets/:marketAddress/dateFrom/:dateFrom", async (request: FastifyRequest<GetHistoricalMarketDataParamsRoute>, reply) => {
    const { marketAddress, dateFrom } = request.params
    try {
      const result = await getMarketHistoricalData(opts.eventRepository, marketAddress, dateFrom)
      return reply.status(200).send(result)
    } catch (err: any) {
      request.log.error("Error fetching total borrow data:", err)
      return reply.status(500).send({ error: "Failed to fetch total borrow data" })
    }
  })
}
