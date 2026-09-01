import { FastifyInstance, FastifyRequest } from "fastify"

import { ProtocolMetricsService } from "../services/protocol_metrics.service.js"

import {
  PositionsRoute,
  GetHistoricalMarketDataRoute,
  GetOracleMarketDataRoute,
  PriceHistoryRoute,
  PricesRoute,
  ProtocolTvl,
  RevenuesRoute,
  sUSG,
  TotalSupply,
  VolumesRoute,
} from "../types.js"

import {
  totalSupplySchema,
  aprsSchema,
  priceHistorySchema,
  pricesSchema,
  revenuesSchema,
  savingAccountsApySchema,
  activePositionsSchema,
  susgHistoricalDataSchema,
  positionsSchema,
  getMarketHistoricalMarketDataSchema,
  getOracleMarketDataSchema,
  tvlSchema,
  volumesSchema,
} from "../schemas/protocol_metrics.schema.js"

export async function registerProtocolMetricsRoute(fastify: FastifyInstance, opts: { protocolMetricsService: ProtocolMetricsService }) {
  async function sendCached<T>(
    request: FastifyRequest,
    reply: { status: (code: number) => { send: (payload: T) => unknown } },
    ttlMs: number,
    producer: () => Promise<T>
  ) {
    const cacheKey = fastify.generateCacheKey(request)
    const cached = fastify.getLongCache<T>(cacheKey)

    if (cached !== undefined) {
      return reply.status(200).send(cached)
    }

    const value = await producer()
    fastify.setLongCache(cacheKey, value, ttlMs)

    return reply.status(200).send(value)
  }

  fastify.get<ProtocolTvl>("/tvl/:dateTo/:dateFrom", tvlSchema, async (request, reply) => {
    try {
      const { dateTo, dateFrom } = request.params

      const parsedDateFrom = dateFrom === "null" ? null : Number(dateFrom)
      const tvl = await opts.protocolMetricsService.getTotalValueLocked(parsedDateFrom, dateTo)

      return reply.status(200).send(tvl)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch tvl" })
    }
  })

  fastify.get<TotalSupply>("/total-supply/:dateTo/:dateFrom/:tokenAddress", totalSupplySchema, async (request, reply) => {
    try {
      const { dateTo, dateFrom, tokenAddress } = request.params

      const parsedDateFrom = dateFrom === "null" ? null : Number(dateFrom)
      const totalSupply = await opts.protocolMetricsService.getTotalSupply(tokenAddress, parsedDateFrom, dateTo)

      return reply.status(200).send(totalSupply)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch total supply" })
    }
  })

  fastify.get("/aprs", aprsSchema, async (request, reply) => {
    try {
      return await sendCached(request, reply, 120_000, async () => {
        return await opts.protocolMetricsService.getLastMarketAprs()
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch APRs" })
    }
  })

  fastify.get("/savingAccounts/apy", savingAccountsApySchema, async (request, reply) => {
    try {
      return await sendCached(request, reply, 120_000, async () => {
        return await opts.protocolMetricsService.getSavingAccountsApy()
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch APRs" })
    }
  })

  fastify.get("/active-positions", activePositionsSchema, async (request, reply) => {
    try {
      const positions = await opts.protocolMetricsService.getActiveBorrowPositions()
      return reply.status(200).send(positions)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch active positions" })
    }
  })

  fastify.get<PricesRoute>("/prices/:tokenAddresses", pricesSchema, async (request, reply) => {
    try {
      const { tokenAddresses } = request.params
      return await sendCached(request, reply, 120_000, async () => {
        return await opts.protocolMetricsService.getLatestPrices(tokenAddresses.split(","))
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch prices" })
    }
  })

  fastify.get<RevenuesRoute>("/revenues/:range", revenuesSchema, async (request, reply) => {
    try {
      const { range } = request.params
      return await sendCached(request, reply, 120_000, async () => {
        return await opts.protocolMetricsService.getRevenues(range)
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch revenues" })
    }
  })

  fastify.get<VolumesRoute>("/volumes/:range", volumesSchema, async (request, reply) => {
    try {
      const { range } = request.params
      return await sendCached(request, reply, 120_000, async () => {
        return await opts.protocolMetricsService.getVolumes(range)
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch volumes" })
    }
  })

  fastify.get<sUSG>("/susg/apy/:dateTo/:dateFrom", susgHistoricalDataSchema, async (request, reply) => {
    try {
      const { dateTo, dateFrom } = request.params

      const parsedDateFrom = dateFrom === "null" ? null : Number(dateFrom)
      const susgAPY = await opts.protocolMetricsService.getSUSGApy(parsedDateFrom, dateTo)

      return reply.status(200).send(susgAPY)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch total supply" })
    }
  })

  fastify.get<PriceHistoryRoute>("/price-history/:tokenAddresses", priceHistorySchema, async (request, reply) => {
    try {
      const { tokenAddresses } = request.params
      const { range } = request.query
      return await sendCached(request, reply, 120_000, async () => {
        return await opts.protocolMetricsService.getPriceHistoryByRange(tokenAddresses.split(","), range)
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch price history" })
    }
  })

  fastify.get<PositionsRoute>("/positions/:marketAddress", positionsSchema, async (request: FastifyRequest<PositionsRoute>, reply) => {
    try {
      const { marketAddress } = request.params
      const result = await opts.protocolMetricsService.getPositions(marketAddress, request.query)
      fastify.log.info(`Query returned ${result.data.length}/${result.total} positions for market ${marketAddress}`)
      return result
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch positions" })
    }
  })

  fastify.get<GetHistoricalMarketDataRoute>("/markets/:marketAddress/dateFrom/:dateFrom", getMarketHistoricalMarketDataSchema, async (request, reply) => {
    try {
      const { marketAddress, dateFrom } = request.params
      const { range = "all" } = request.query
      const result = await opts.protocolMetricsService.getMarketHistoricalData(marketAddress, dateFrom, range)
      return reply.status(200).send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch events" })
    }
  })

  fastify.get<GetOracleMarketDataRoute>("/oracle/:marketAddress", getOracleMarketDataSchema, async (request, reply) => {
    try {
      const { marketAddress } = request.params
      const { dateEnd, bucketCount, bucketSizeMinutes } = request.query
      return await opts.protocolMetricsService.getOraclePriceBuckets(marketAddress, dateEnd, bucketCount, bucketSizeMinutes)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch oracle prices" })
    }
  })
}
