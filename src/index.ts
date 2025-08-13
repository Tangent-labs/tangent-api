import Fastify, { FastifyInstance } from "fastify"
import Postgres from "@fastify/postgres"
import fastifyRateLimit from "@fastify/rate-limit"
import fastifyCors from "@fastify/cors"
import dotenv from "dotenv"
import prismaPlugin from "./plugins/prisma"
import { registerReferralRoute } from "./routes/referral.route"
import { registerEventsRoute } from "./routes/events.route"
import { EventRepository } from "./data/events.data"
import { ReferalRepository } from "./data/referral.data"
import { ReferalService } from "./services/referral.service"

dotenv.config()

const fastify: FastifyInstance = Fastify({ logger: true })

// Register plugins
fastify.register(prismaPlugin)
fastify.register(Postgres, {
  connectionString: process.env.DATABASE_URL,
})
fastify.register(fastifyCors, {
  origin: true,
})
fastify.register(fastifyRateLimit, {
  max: 100,
  timeWindow: "15 minutes",
})

const eventRepository = new EventRepository(fastify)
const referalRepository = new ReferalRepository(fastify)
const referalService = new ReferalService(referalRepository)
// Register routes
fastify.register(registerReferralRoute, { referalService })
fastify.register(registerEventsRoute, { eventRepository })

// Graceful shutdown
const start = async () => {
  try {
    await fastify.listen({ port: 3100, host: "127.0.0.1" })
    fastify.log.info(`Server listening on http://127.0.0.1:3100`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

const stop = async () => {
  await fastify.close()
}

process.on("SIGINT", stop)
process.on("SIGTERM", stop)

start()
