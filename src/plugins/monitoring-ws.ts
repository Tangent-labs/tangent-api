import { FastifyInstance, FastifyPluginAsync } from "fastify"
import fp from "fastify-plugin"
import { WebSocket } from "ws"

import { MonitoringService } from "../services/monitoring.service.js"
import { parseMonitoringQuery } from "../services/monitoring/monitoring.filters.js"

const BROADCAST_INTERVAL_MS = 60_000
const MAX_CLIENTS = 100
const MAX_CONNECTIONS_PER_IP = 5

interface MonitoringWsOptions {
  monitoringService: MonitoringService
}

const monitoringWsPlugin: FastifyPluginAsync<MonitoringWsOptions> = async (fastify, opts) => {
  const { monitoringService } = opts
  const clients = new Set<WebSocket>()
  const connectionsPerIp = new Map<string, number>()
  let intervalId: ReturnType<typeof setInterval> | null = null
  let lastPayload: string | null = null

  fastify.get("/monitoring/ws", { websocket: true }, (socket, request) => {
    const ip = request.ip
    const currentCount = connectionsPerIp.get(ip) ?? 0

    if (clients.size >= MAX_CLIENTS || currentCount >= MAX_CONNECTIONS_PER_IP) {
      socket.close(4002, "Too many connections")
      return
    }

    connectionsPerIp.set(ip, currentCount + 1)
    clients.add(socket)

    // Send last known data immediately on connect
    if (lastPayload && socket.readyState === WebSocket.OPEN) {
      socket.send(lastPayload)
    }

    function removeClient() {
      if (!clients.has(socket)) return
      clients.delete(socket)
      const remaining = (connectionsPerIp.get(ip) ?? 1) - 1
      if (remaining <= 0) {
        connectionsPerIp.delete(ip)
      } else {
        connectionsPerIp.set(ip, remaining)
      }
    }

    socket.on("close", removeClient)
    socket.on("error", removeClient)
  })

  async function fetchAndBroadcast(instance: FastifyInstance) {
    try {
      const parsed = parseMonitoringQuery({ modules: "all" })

      const result = await monitoringService.getModules(parsed, {
        getLongCache: (key: string) => instance.getLongCache(key),
        setLongCache: (key: string, value: unknown, ttlMs?: number) => instance.setLongCache(key, value, ttlMs),
      })

      lastPayload = JSON.stringify(result)

      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(lastPayload)
        }
      }
    } catch (err) {
      instance.log.error(err, "Monitoring WS broadcast failed")
    }
  }

  fastify.addHook("onReady", async () => {
    // First fetch in background (don't block server startup)
    fetchAndBroadcast(fastify)
    intervalId = setInterval(() => fetchAndBroadcast(fastify), BROADCAST_INTERVAL_MS)
  })

  fastify.addHook("onClose", async () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    for (const client of clients) {
      client.close()
    }
    clients.clear()
    connectionsPerIp.clear()
  })
}

export default fp(monitoringWsPlugin, {
  name: "monitoring-ws",
  dependencies: ["websocket", "cache"],
})
