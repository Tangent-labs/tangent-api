import { FastifyInstance } from "fastify"
import { UserService } from "../services/user.service.js"

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
      } catch (e: any) {
        reply.code(e.statusCode || 401).send({ error: e.message || "Unauthorized" })
      }
    },
    handler: async (request, reply) => {
      const { address } = request.body || null
      try {
        await opts.userService.registerAddress(address.toLowerCase())

        reply.code(200).send({ ok: true })
      } catch (err: any) {
        fastify.log.error(err)
        reply.code(err.statusCode || 500).send({ error: err.message || `Failed to register user with address ${address}` })
      }
    },
  })
}
