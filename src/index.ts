import Fastify, { FastifyInstance } from "fastify";
import Postgres from "@fastify/postgres";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyCors from "@fastify/cors";
import dotenv from "dotenv";
import prismaPlugin from "./plugins/prisma";
import { registerReferralRoute } from "./routes/referral.route";
import { registerEventsRoute } from "./routes/events.route";

dotenv.config();

const fastify: FastifyInstance = Fastify({ logger: true });

// Register plugins
fastify.register(prismaPlugin);
fastify.register(Postgres, {
  connectionString: process.env.DATABASE_URL,
});
fastify.register(fastifyCors, {
  origin: true,
});
fastify.register(fastifyRateLimit, {
  max: 100,
  timeWindow: "15 minutes",
});

// Register routes
fastify.register(registerReferralRoute);
fastify.register(registerEventsRoute);

// Graceful shutdown
const start = async () => {
  try {
    await fastify.listen({ port: 3100, host: "127.0.0.1" });
    fastify.log.info(`Server listening on http://127.0.0.1:3100`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

const stop = async () => {
  await fastify.close();
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

start();
