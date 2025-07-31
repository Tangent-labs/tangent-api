import { FastifyInstance, FastifyRequest } from "fastify";
import {
  verifyAndCreateReferralRelationship,
  generateNewReferralCode,
  getReferralStatus,
} from "../services/referral.service";
import {
  referralSchema,
  generateReferralSchema,
  referralStatusSchema,
} from "./shemas";
import { ReferralInput } from "../types";

interface ReferralRoute {
  Body: ReferralInput;
}

interface GenerateReferralRoute {
  Body: {
    account: string;
  };
}

interface ReferralStatusRoute {
  Querystring: {
    account: string;
  };
}

export async function registerReferralRoute(fastify: FastifyInstance) {
  fastify.post<ReferralRoute>(
    "/referral",
    referralSchema,
    async (request: FastifyRequest<ReferralRoute>, reply) => {
      try {
        const result = await verifyAndCreateReferralRelationship(
          fastify.prisma,
          request.body,
          fastify.log
        );

        return reply.status(200).send(result);
      } catch (err: any) {
        request.log.error("Error processing referral:", err);
        return reply
          .status(
            err.message.includes("Invalid") || err.message.includes("already")
              ? 400
              : 500
          )
          .send({ error: err.message });
      }
    }
  );

  fastify.post<GenerateReferralRoute>(
    "/referral/generate",
    generateReferralSchema,
    async (request: FastifyRequest<GenerateReferralRoute>, reply) => {
      try {
        const { account } = request.body;
        const result = await generateNewReferralCode(
          fastify.prisma,
          account,
          fastify.log
        );
        return reply.status(200).send(result);
      } catch (err: any) {
        request.log.error("Error generating referral code:", err);
        return reply
          .status(
            err.message.includes("Invalid") || err.message.includes("already")
              ? 400
              : 500
          )
          .send({ error: err.message || "Failed to generate referral code" });
      }
    }
  );

  fastify.get<ReferralStatusRoute>(
    "/referral/status",
    referralStatusSchema,
    async (request: FastifyRequest<ReferralStatusRoute>, reply) => {
      try {
        const { account } = request.query;
        const result = await getReferralStatus(
          fastify.prisma,
          account,
          fastify.log
        );
        return reply.status(200).send(result);
      } catch (err: any) {
        request.log.error("Error fetching referral status:", err);
        return reply
          .status(err.message.includes("User not found") ? 404 : 400)
          .send({ error: err.message || "Failed to fetch referral status" });
      }
    }
  );
}
