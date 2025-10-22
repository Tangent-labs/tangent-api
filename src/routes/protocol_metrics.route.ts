import { FastifyInstance } from "fastify"
import { TotalSupply } from "../types.js"
import { aprsSchema, totalSupplySchema } from "./shemas.js"
import { ProtocolMetricsService } from "../services/protocol_metrics.service.js"

export async function registerProtocolMetricsRoute(fastify: FastifyInstance, opts: { protocolMetricsService: ProtocolMetricsService }) {
  fastify.post<TotalSupply>("/total-supply", totalSupplySchema, async (request, reply) => {
    try {
      const { dateTo, dateFrom, tokenAddress } = request.body

      const totalSupply = await opts.protocolMetricsService.getTotalSupply(tokenAddress, dateFrom, dateTo)

      return reply.status(200).send(totalSupply)
    } catch (err: any) {
      request.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch total supply" })
    }
  })

  fastify.get("/aprs", aprsSchema, async (request, reply) => {
    try {
      const APRs = await opts.protocolMetricsService.getLastMarketAprs()

      return reply.status(200).send(APRs)
    } catch (err: any) {
      request.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch APRs" })
    }
  })
}
