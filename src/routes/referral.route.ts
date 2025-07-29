import { FastifyInstance, FastifyRequest } from "fastify";
import {
  verifyAndProcessReferral,
  generateNewReferralCode,
  getReferralStatus,
} from "../services/referral.service";
import {
  generateReferralSchema,
  referralSchema,
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
  // POST /referral for validating and processing referral codes
  fastify.post<ReferralRoute>(
    "/referral",
    referralSchema,
    async (request: FastifyRequest<ReferralRoute>, reply) => {
      try {
        const result = await verifyAndProcessReferral(
          fastify.prisma,
          request.body,
          fastify.log
        );
        fastify.log.info("RESULT of verifyAndProcessReferral:", result);
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

  // POST /referral/generate for generating a new referral code
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

  // GET /referral/status for checking user referral status
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

        console.log("RESULT : ", result);

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
