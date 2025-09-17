import { FastifyInstance, FastifyRequest } from "fastify"
import { EventsService } from "../services/events.service"
import { EventsRoute, GetHistoricalMarketDataRoute, UserPoints, UserTasks } from "../types"
import { eventsSchema, getMarketHistoricalMarketDataSchema, userPointsSchema, userTasksSchema } from "./shemas"

export async function registerEventsRoute(fastify: FastifyInstance, opts: { eventsService: EventsService }) {
  fastify.get<EventsRoute>("/events/:account/:market", eventsSchema, async (request: FastifyRequest<EventsRoute>, reply) => {
    try {
      const { account, market } = request.params

      const rawEvents = await opts.eventsService.getEventsByAccount(account, market)

      const transformedEvents = opts.eventsService.transformEvents(rawEvents)
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
      const result = await opts.eventsService.getMarketHistoricalData(marketAddress, dateFrom, range)
      return reply.status(200).send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch events" })
    }
  })

  fastify.get<UserTasks>("/tasks/:userAddress", userTasksSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await opts.eventsService.getUserTasks(userAddress)
      return reply.status(200).send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user lp tasks" })
    }
  })

  fastify.get<UserTasks>("/tasks/vote/:userAddress", userTasksSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await opts.eventsService.getUserVoteTasks(userAddress)
      return reply.status(200).send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user vote tasks" })
    }
  })

  fastify.get<UserPoints>("/points/:userAddress/:dateFrom", userPointsSchema, async (request, reply) => {
    try {
      const { userAddress, dateFrom } = request.params
      const result = await opts.eventsService.getLpUserPoints(userAddress, dateFrom)
      return reply.status(200).send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user points" })
    }
  })
}
