import dotenv from "dotenv"
import fastifyCors from "@fastify/cors"
import Postgres from "@fastify/postgres"
import fastifyRateLimit from "@fastify/rate-limit"
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";

import Fastify, { FastifyInstance } from "fastify"

import prismaPlugin from "./plugins/prisma.js"
import { EventRepository } from "./data/events.data.js"
import { ReferralRepository } from "./data/referral.data.js"
import { EventsService } from "./services/events.service.js"
import { registerEventsRoute } from "./routes/events.route.js"
import { ReferralService } from "./services/referral.service.js"
import { registerReferralRoute } from "./routes/referral.route.js"
import { LeaderboardService } from "./services/leaderboard.service.js"
import { LeaderboardRepository } from "./data/leaderboard.data.js"
import { registerLeaderboardRoutes } from "./routes/leaderboard.route.js"

dotenv.config()

const fastify: FastifyInstance = Fastify({ logger: true })

// Register plugins
fastify.register(prismaPlugin)

// 1️⃣ Generate OpenAPI spec
fastify.register(swagger, {
  openapi: {
    info: {
      title: "Fastify TS API",
      description: "A Fastify API with OpenAPI 3 and Swagger UI",
      version: "1.0.0",
    },
    servers: [
      { url: "http://localhost:3100" }
    ],
  },
});

fastify.register(swaggerUI, {
  routePrefix: "/docs", // Swagger UI available at http://localhost:3000/docs
  uiConfig: {
    docExpansion: "list",   // optional UI settings
    deepLinking: true,
  },
  // No 'exposeRoute', it's enabled by default
});

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

  const leaderboardRepository = new LeaderboardRepository(f.prisma)
  const leaderboardService = new LeaderboardService(leaderboardRepository)

  fastify.register(registerLeaderboardRoutes, { leaderboardService })
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
