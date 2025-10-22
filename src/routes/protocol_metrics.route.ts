import { FastifyInstance } from "fastify"
import { aprsSchema, savingAccountsApySchema, totalSupplySchema } from "./shemas.js"
import { TotalSupply } from "../types.js"
import { ProtocolMetricsService } from "../services/protocol_metrics.service.js"

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
      // Temporarily disable cache to debug the issue
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
}
