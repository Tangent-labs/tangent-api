import { FastifyInstance, FastifyRequest } from "fastify"
import { EventRepository } from "../data/events.data"
import { getMarketHistoricalData, getUserTasks, transformEvents } from "../services/events.service"
import { eventsSchema, getMarketHistoricalMarketDataSchema, userTasksSchema } from "./shemas"
import { EventsRoute, GetHistoricalMarketDataRoute, UserTasks } from "../types"

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

  fastify.get<GetHistoricalMarketDataRoute>("/markets/:marketAddress/dateFrom/:dateFrom", getMarketHistoricalMarketDataSchema, async (request, reply) => {
    try {
      const { marketAddress, dateFrom } = request.params
      const { range = "all" } = request.query
      const result = await getMarketHistoricalData(opts.eventRepository, marketAddress, dateFrom, range)

      return reply.status(200).send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch events" })
    }
  })

  fastify.get<UserTasks>("/tasks/:userAddress", userTasksSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await getUserTasks(opts.eventRepository, userAddress)

      return reply.status(200).send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user tasks" })
    }
  })
}
