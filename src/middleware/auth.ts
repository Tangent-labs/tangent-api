import { FastifyReply, FastifyRequest } from "fastify"
import { toError } from "../utils.js"

export function secretTokenPreHandler(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  try {
    const auth = request.headers["authorization"]
    const required = `Bearer ${process.env.SECRET_TOKEN}`

    if (auth !== required) {
      reply.code(401).send({ error: "Unauthorized" })
    }

    done()
  } catch (err) {
    const errTyped = toError(err)
    reply.code(errTyped.statusCode || 401).send({ error: errTyped.message || "Unauthorized" })
  }
}
