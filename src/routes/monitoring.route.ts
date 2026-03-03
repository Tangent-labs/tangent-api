import { FastifyInstance } from "fastify"

import { MonitoringService } from "../services/monitoring.service.js"
import { parseMonitoringQuery } from "../services/monitoring/monitoring.filters.js"
import { getThresholds } from "../services/monitoring/monitoring.thresholds.js"
import { MODULE_CONFIG } from "../services/monitoring/monitoring.types.js"
import { monitoringSchema, thresholdsGetSchema } from "../schemas/monitoring.schema.js"

export async function registerMonitoringRoute(fastify: FastifyInstance, opts: { monitoringService: MonitoringService }) {
  fastify.get("/monitoring", monitoringSchema, async (request, reply) => {
    try {
      const query = (request.query || {}) as Record<string, string | number>
      const parsed = parseMonitoringQuery(query)

      const result = await opts.monitoringService.getModules(parsed, {
        getLongCache: (key: string) => fastify.getLongCache(key),
        setLongCache: (key: string, value: unknown, ttlMs?: number) => fastify.setLongCache(key, value, ttlMs),
      })

      const minTtl = Math.min(...parsed.requestedModules.map((m) => MODULE_CONFIG[m].ttl))
      reply.header("Cache-Control", `public, max-age=${minTtl}`)

      return reply.status(200).send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch monitoring data" })
    }
  })

  fastify.get("/monitoring/thresholds", thresholdsGetSchema, async (_request, reply) => {
    return reply.status(200).send(getThresholds())
  })
}
