import { FastifyInstance, FastifyReply, RouteShorthandOptions } from "fastify"

import { UsgSupplyService } from "../services/usg_supply.service.js"

const CACHE_TTL_MS = 300_000

const supplySchema = (description: string): RouteShorthandOptions => ({
  schema: {
    tags: ["USG"],
    description,
    response: {
      200: {
        type: "object",
        properties: { result: { type: "string" } },
        required: ["result"],
      },
    },
  },
})

export async function registerUsgSupplyRoute(fastify: FastifyInstance, opts: { usgSupplyService: UsgSupplyService }) {


  async function sendCachedSupply(reply: FastifyReply, cacheKey: string, producer: () => Promise<string>) {
    let value = fastify.getLongCache<string>(cacheKey)

    if (value === undefined) {
      value = await producer()
      fastify.setLongCache(cacheKey, value, CACHE_TTL_MS)
    }

    return reply.status(200).send({ result: value })
  }

  fastify.get("/usg/total-supply", supplySchema("USG total supply, decimal-adjusted."), async (_request, reply) => {
    try {
      return await sendCachedSupply(reply, "usg:total-supply", () => opts.usgSupplyService.getTotalSupply())
    } catch (err) {
      fastify.log.error(err)
      // A wrong or stale number is worse for a price aggregator than no number.
      return reply.status(503).send({ error: "Failed to fetch USG total supply" })
    }
  })

  fastify.get(
    "/usg/circulating-supply",
    supplySchema("USG circulating supply (total supply minus pegkeeper balances), decimal-adjusted."),
    async (_request, reply) => {
      try {
        return await sendCachedSupply(reply, "usg:circulating-supply", () => opts.usgSupplyService.getCirculatingSupply())
      } catch (err) {
        fastify.log.error(err)
        return reply.status(503).send({ error: "Failed to fetch USG circulating supply" })
      }
    }
  )
}
