import { FastifyInstance, FastifyRequest } from "fastify"
import { EventsRoute, GetHistoricalMarketDataRoute, sUSG, TotalSupply } from "../types.js"
import { ProtocolMetricsService } from "../services/protocol_metrics.service.js"
import { totalSupplySchema, aprsSchema, savingAccountsApySchema, susgHistoricalDataSchema, eventsSchema, getMarketHistoricalMarketDataSchema } from "../schemas/protocol_metrics.schema.js"

export async function registerProtocolMetricsRoute(fastify: FastifyInstance, opts: { protocolMetricsService: ProtocolMetricsService }) {
  fastify.get<TotalSupply>("/total-supply/:dateTo/:dateFrom/:tokenAddress", totalSupplySchema, async (request, reply) => {
    try {
      const { dateTo, dateFrom, tokenAddress } = request.params

      const parsedDateFrom = dateFrom === "null" ? null : Number(dateFrom)

      const totalSupply = await opts.protocolMetricsService.getTotalSupply(tokenAddress, parsedDateFrom, dateTo)

      return reply.status(200).send(totalSupply)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch total supply" })
    }
  })

  fastify.get("/aprs", aprsSchema, async (_, reply) => {
    try {
      const APRs = await opts.protocolMetricsService.getLastMarketAprs()

      return reply.status(200).send(APRs)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch APRs" })
    }
  })

  fastify.get("/savingAccounts/apy", savingAccountsApySchema, async (request, reply) => {
    try {
      const cacheKey = fastify.generateCacheKey(request)
      let apys = fastify.longCache.get(cacheKey)
      if (!apys) {
        apys = await opts.protocolMetricsService.getSavingAccountsApy()
        fastify.setLongCache(cacheKey, apys, 10_000)
      }
      return reply.status(200).send(apys)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch APRs" })
    }
  })

  fastify.get<sUSG>("/susg/apy/:dateTo/:dateFrom", susgHistoricalDataSchema, async (request, reply) => {
    try {
      const { dateTo, dateFrom } = request.params

      const parsedDateFrom = dateFrom === "null" ? null : Number(dateFrom)

      const susgAPY = await opts.protocolMetricsService.getSUSGApy(parsedDateFrom, dateTo)

      return reply.status(200).send(susgAPY)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch total supply" })
    }
  })

  fastify.get<EventsRoute>("/events/:account/:market", eventsSchema, async (request: FastifyRequest<EventsRoute>, reply) => {
    try {
      const { account, market } = request.params

      const rawEvents = await opts.protocolMetricsService.getEventsByAccount(account.toLowerCase(), market)

      const transformedEvents = opts.protocolMetricsService.transformEvents(rawEvents)
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
      const result = await opts.protocolMetricsService.getMarketHistoricalData(marketAddress, dateFrom, range)
      return reply.status(200).send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch events" })
    }
  })
}
