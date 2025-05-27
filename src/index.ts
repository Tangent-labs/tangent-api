import Fastify, { FastifyInstance, RouteShorthandOptions } from "fastify";
import Postgres from "@fastify/postgres";
import dotenv from "dotenv";
import { getEventsByAccount } from "./data/events.data";
import { transformEvents, TransformedEvent } from "./services/events.service";

// Interface for the route parameters and response
interface EventsRoute {
  Params: { account: string; market: string };
  Reply: TransformedEvent[] | { error: string };
}

// Initialize dotenv to load environment variables
dotenv.config();

// Create Fastify instance with logger
const fastify: FastifyInstance = Fastify({ logger: true });

// Register the PostgreSQL plugin
fastify.register(Postgres, {
  connectionString: process.env.DATABASE_URL,
});

// Route to get all events for a user
const eventsSchema: RouteShorthandOptions = {
  schema: {
    params: {
      type: "object",
      properties: {
        account: { type: "string" },
      },
      required: ["account"],
    },
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            collatAmount: { type: "string" },
            usgAmount: { type: "string" },
            date: { type: "string", format: "date-time" },
            txHash: { type: "string" },
          },
        },
      },
      500: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
};

fastify.get<EventsRoute>(
  "/events/:account/:market",
  eventsSchema,
  async (request, reply) => {
    const { account, market } = request.params;
    try {
      const rawEvents = await getEventsByAccount(fastify, account, market);
      const transformedEvents = transformEvents(rawEvents);
      fastify.log.info(
        `Query returned ${
          transformedEvents.length
        } rows for account ${account}: ${JSON.stringify(transformedEvents)}`
      );
      return transformedEvents;
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch events" });
    }
  }
);

// Start the server
fastify.listen({ port: 3100, host: "127.0.0.1" }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  const address = fastify.server.address();
  const addressStr =
    typeof address === "string"
      ? address
      : `http://${address?.address}:${address?.port}`;
  fastify.log.info(`Server listening on ${addressStr}`);
});
