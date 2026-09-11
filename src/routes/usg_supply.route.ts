import { FastifyInstance } from "fastify"

import { UsgSupplyService } from "../services/usg_supply.service.js"

import { usgTotalSupplySchema, usgTotalSupplyPlainSchema, usgCirculatingSupplySchema, usgCirculatingSupplyPlainSchema } from "../schemas/usg_supply.schema.js"

const CACHE_TTL_MS = 300_000

const TOTAL_SUPPLY_KEY = "usg:total-supply"
const CIRCULATING_SUPPLY_KEY = "usg:circulating-supply"

export async function registerUsgSupplyRoute(fastify: FastifyInstance, opts: { usgSupplyService: UsgSupplyService }) {

  async function getCachedSupply(cacheKey: string, producer: () => Promise<string>): Promise<string> {
    let value = fastify.getLongCache<string>(cacheKey)

    if (value === undefined) {
      value = await producer()
      fastify.setLongCache(cacheKey, value, CACHE_TTL_MS)
    }

    return value
  }

  fastify.get("/usg/total-supply", usgTotalSupplySchema, async (_request, reply) => {
    try {

      const totalSupply = await getCachedSupply(TOTAL_SUPPLY_KEY, () => opts.usgSupplyService.getTotalSupply())
      return reply.status(200).send({ result: totalSupply })
    } catch (err) {
      fastify.log.error(err)
      // A wrong or stale number is worse for a price aggregator than no number.
      return reply.status(503).send({ error: "Failed to fetch USG total supply" })
    }
  })

  fastify.get("/usg/total-supply/plain", usgTotalSupplyPlainSchema, async (_request, reply) => {
    try {
      const totalSupply = await getCachedSupply(TOTAL_SUPPLY_KEY, () => opts.usgSupplyService.getTotalSupply())
      return reply.type("text/plain").status(200).send(totalSupply)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(503).send({ error: "Failed to fetch USG total supply" })
    }
  })

  fastify.get("/usg/circulating-supply", usgCirculatingSupplySchema, async (_request, reply) => {
    try {
      const circulatingSupply = await getCachedSupply(CIRCULATING_SUPPLY_KEY, () => opts.usgSupplyService.getCirculatingSupply())
      return reply.status(200).send({ result: circulatingSupply })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(503).send({ error: "Failed to fetch USG circulating supply" })
    }
  })

  fastify.get("/usg/circulating-supply/plain", usgCirculatingSupplyPlainSchema, async (_request, reply) => {
    try {
      const circulatingSupply = await getCachedSupply(CIRCULATING_SUPPLY_KEY, () => opts.usgSupplyService.getCirculatingSupply())
      return reply.type("text/plain").status(200).send(circulatingSupply)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(503).send({ error: "Failed to fetch USG circulating supply" })
    }
  })
}
