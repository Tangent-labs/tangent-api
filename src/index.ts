import dotenv from "dotenv"
import fastifyCors from "@fastify/cors"
import Postgres from "@fastify/postgres"
import prismaPlugin from "./plugins/prisma"
import fastifyRateLimit from "@fastify/rate-limit"
import Fastify, { FastifyInstance } from "fastify"
import { EventRepository } from "./data/events.data"
import { ReferralRepository } from "./data/referral.data"
import { EventsService } from "./services/events.service"
import { registerEventsRoute } from "./routes/events.route"
import { ReferralService } from "./services/referral.service"
import { registerReferralRoute } from "./routes/referral.route"

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

fastify.register(async (f) => {
  const eventRepository = new EventRepository(f.prisma)
  const eventsService = new EventsService(eventRepository)

  const referralRepository = new ReferralRepository(f.prisma)
  const referralService = new ReferralService(referralRepository)

  fastify.register(registerReferralRoute, { referralService })
  fastify.register(registerEventsRoute, { eventsService })
})

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
