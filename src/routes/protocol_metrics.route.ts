import { TotalSupply } from "../types"
import { FastifyInstance } from "fastify"
import { aprsSchema, totalSupplySchema } from "./shemas"
import { ProtocolMetricsService } from "../services/protocol_metrics.service"

export async function registerProtocolMetricsRoute(fastify: FastifyInstance, opts: { protocolMetricsService: ProtocolMetricsService }) {
  fastify.get<TotalSupply>("/total-supply/:dateTo/:dateFrom/:tokenAddress", totalSupplySchema, async (request, reply) => {
    try {
      const { dateTo, dateFrom, tokenAddress } = request.params

      const totalSupply = await opts.protocolMetricsService.getTotalSupply(tokenAddress, dateFrom, dateTo)

      return reply.status(200).send(totalSupply)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch total supply" })
    }
  })

  fastify.get("/aprs", aprsSchema, async (_, reply) => {
    try {
      const APRs = await opts.protocolMetricsService.getAPRs()

      return reply.status(200).send(APRs)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch APRs" })
    }
  })
}
