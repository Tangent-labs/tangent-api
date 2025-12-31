import dotenv from "dotenv"
import fastifyCors from "@fastify/cors"
import Postgres from "@fastify/postgres"
import swagger from "@fastify/swagger"
import swaggerUI from "@fastify/swagger-ui"
import rateLimit from '@fastify/rate-limit'

import Fastify, { FastifyInstance } from "fastify"

import prismaPlugin from "./plugins/prisma.js"
import cachePlugin from "./plugins/cache.js"
import { PointsRepository } from "./data/points.data.js"
import { ReferralRepository } from "./data/referral.data.js"
import { ReferralService } from "./services/referral.service.js"
import { registerReferralRoute } from "./routes/referral.route.js"
import { ProtocolMetricsRepository } from "./data/protocol_metrics.data.js"
import { ProtocolMetricsService } from "./services/protocol_metrics.service.js"
import { registerProtocolMetricsRoute } from "./routes/protocol_metrics.route.js"
import { UserRepository } from "./data/user.data.js"
import { UserService } from "./services/user.service.js"
import { registerUserRoute } from "./routes/user.route.js"
import { PredepositService } from "./services/predeposit.service.js"
import { PredepositRepository } from "./data/predeposit.data.js"
import { registerPredepositRoutes } from "./routes/predeposit.route.js"
import { registerPointsProgramRoutes } from "./routes/points.route.js"
import { PointsService } from "./services/points.service.js"

dotenv.config()

const fastify: FastifyInstance = Fastify({ logger: true })

// Register plugins
fastify.register(prismaPlugin)
fastify.register(cachePlugin)
fastify.register(rateLimit, {
  max: 100,            // max requests
  timeWindow: '1 minute' // per IP per time window
})

// 1️⃣ Generate OpenAPI spec
fastify.register(swagger, {
  openapi: {
    info: {
      title: "Fastify TS API",
      description: "A Fastify API with OpenAPI 3 and Swagger UI",
      version: "1.0.0",
    },
    servers: [{ url: "http://localhost:3100" }],
  },
})

fastify.register(swaggerUI, {
  routePrefix: "/docs", // Swagger UI available at http://localhost:3000/docs
  uiConfig: {
    docExpansion: "list", // optional UI settings
    deepLinking: true,
  },
  // No 'exposeRoute', it's enabled by default
})

fastify.register(Postgres, {
  connectionString: process.env.DATABASE_URL,
})

fastify.register(fastifyCors, {
  // origin: ["http://localhost:3000", "http://localhost:3100", "http://127.0.0.1:3100", "https://tangent-dapp.vercel.app"],
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
})

fastify.register(async (f) => {
  const userRepository = new UserRepository(f.prisma)
  const userService = new UserService(userRepository)

  const protocolMetricsRepository = new ProtocolMetricsRepository(f.prisma)
  const protocolMetricsService = new ProtocolMetricsService(protocolMetricsRepository)

  const referralRepository = new ReferralRepository(f.prisma)
  const referralService = new ReferralService(referralRepository)

  const pointsRepository = new PointsRepository(f.prisma)
  const pointsService = new PointsService(pointsRepository)

  const predepositRepository = new PredepositRepository(f.prisma)
  const predepositService = new PredepositService(predepositRepository)

  fastify.register(registerPointsProgramRoutes, { pointsService })
  fastify.register(registerReferralRoute, { referralService })
  fastify.register(registerProtocolMetricsRoute, { protocolMetricsService })
  fastify.register(registerPredepositRoutes, { predepositService })
  fastify.register(registerUserRoute, { userService })
})

// Graceful shutdown
const start = async () => {
  try {
    await fastify.listen({ port: 3100, host: "0.0.0.0" })
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
