import { FastifyInstance } from "fastify"
import { UserService } from "../services/user.service.js"
import { toError } from "../utils.js"

interface RegisterUser {
  Body: { address: string }
}

export async function registerUserRoute(fastify: FastifyInstance, opts: { userService: UserService }) {
  fastify.post<RegisterUser>("/user/register", {
    preHandler: (request, reply, done) => {
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
    },
    handler: async (request, reply) => {
      const { address } = request.body || null
      try {
        await opts.userService.registerAddress(address.toLowerCase())

        reply.code(200).send({ ok: true })
      } catch (err) {
        const errTyped = toError(err)
        fastify.log.error(errTyped)
        reply.code(errTyped?.statusCode || 500).send({ error: errTyped.message || `Failed to register user with address ${address}` })
      }
    },
  })
}
