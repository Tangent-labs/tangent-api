import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify"
import fp from "fastify-plugin"
import { LRUCache } from "lru-cache"

interface CacheOptions {
  shortMax?: number
  longMax?: number
  includeQuery?: boolean
  keyPrefix?: string
  monitoring?: boolean
}

declare module "fastify" {
  interface FastifyInstance {
    shortCache: LRUCache<string, any>
    longCache: LRUCache<string, any>
    generateCacheKey: (request: FastifyRequest, customPrefix?: string) => string
    setLongCache: (key: string, value: any, ttlMs?: number) => void
    getLongCache: (key: string) => any
  }
}

const cachePlugin: FastifyPluginAsync<CacheOptions> = async (fastify, opts) => {
  // Default options
  const { shortMax = 100, longMax = 500, includeQuery = false, keyPrefix = "", monitoring = false } = opts || {}

  // Short cache (2 minutes)
  const shortCache = new LRUCache<string, any>({
    max: shortMax,
    ttl: 1000 * 60 * 2,
    allowStale: false,
  })

  // Long cache : TTL per item (customizable)
  const longCache = new LRUCache<string, any>({
    max: longMax,
    ttl: 1000 * 60 * 60, // 1H
    allowStale: true,
  })

  // Helper : generate unique key with route & params
  fastify.decorate("generateCacheKey", (request: FastifyRequest, customPrefix = keyPrefix) => {
    const paramsStr = JSON.stringify(request.params || {}).replace(/[:{}]/g, "")
    let queryStr = ""
    if (includeQuery && request.query) {
      queryStr = JSON.stringify(request.query).replace(/[:{}]/g, "")
    }
    const baseKey = `${request.method}:${request.url}:${paramsStr}${queryStr}`
    return customPrefix ? `${customPrefix}${baseKey}` : baseKey
  })

  // Helper for longCache allow custom TTL
  fastify.decorate("setLongCache", (key: string, value: any, ttlMs?: number) => {
    if (ttlMs) {
      longCache.set(key, value, { ttl: ttlMs })
    } else {
      longCache.set(key, value)
    }
  })

  fastify.decorate("getLongCache", (key: string) => {
    return longCache.get(key)
  })

  // Inject caches
  fastify.decorate("shortCache", shortCache)
  fastify.decorate("longCache", longCache)

  // Monitoring optional
  if (monitoring) {
    fastify.log.info("Cache monitoring enabled")
  }

  // Cleanup au shutdown
  fastify.addHook("onClose", async (instance: FastifyInstance) => {
    instance.log.info("Closing caches...")
  })
}

export default fp(cachePlugin, {
  name: "cache",
})
