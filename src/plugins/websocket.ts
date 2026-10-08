import fp from "fastify-plugin"
import websocket from "@fastify/websocket"
import { FastifyPluginAsync } from "fastify"

const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(websocket, { options: { maxPayload: 1024 } })
}

export default fp(websocketPlugin, {
  name: "websocket",
})
