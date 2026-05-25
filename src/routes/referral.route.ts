import { ReferralInput } from "../types.js"
import { FastifyInstance, FastifyRequest } from "fastify"
import { ReferralService } from "../services/referral.service.js"
import { generateReferralSchema, referralSchema, referralStatusSchema } from "../schemas/referral.schema.js"
import { toError, UserError } from "../utils.js"
import { secretTokenPreHandler } from "../middleware/auth.js"

interface ReferralRoute {
  Body: ReferralInput
}

interface GenerateReferralRoute {
  Body: {
    account: string
  }
}

interface ReferralStatusRoute {
  Querystring: {
    account: string
  }
}

export async function registerReferralRoute(fastify: FastifyInstance, opts: { referralService: ReferralService }) {
  fastify.post<ReferralRoute>("/referral", referralSchema, async (request: FastifyRequest<ReferralRoute>, reply) => {
    try {
      const result = await opts.referralService.verifyAndCreateReferralRelationship(request.body, fastify.log)

      return reply.status(200).send(result)
    } catch (err) {
      request.log.error({ msg: "Error processing referral:", err })
      const errTyped = toError(err)
      return reply.status(err instanceof UserError ? 400 : 500).send({ error: errTyped.message })
    }
  })

  fastify.post<GenerateReferralRoute>(
    "/referral/generate",
    { ...generateReferralSchema, preHandler: secretTokenPreHandler },
    async (request: FastifyRequest<GenerateReferralRoute>, reply) => {
      try {
        const { account } = request.body
        const result = await opts.referralService.generateNewReferralCode(account, fastify.log)
        return reply.status(200).send(result)
      } catch (err) {
        request.log.error({ msg: "Error generating referral code:", err })
        const errTyped = toError(err)
        return reply
          .status(errTyped.message.includes("Invalid") || errTyped.message.includes("already") ? 400 : 500)
          .send({ error: errTyped.message || "Failed to generate referral code" })
      }
    }
  )

  fastify.get<ReferralStatusRoute>("/referral/status", referralStatusSchema, async (request: FastifyRequest<ReferralStatusRoute>, reply) => {
    try {
      const { account } = request.query
      const result = await opts.referralService.getReferralStatus(account, fastify.log)
      return reply.status(200).send(result)
    } catch (err) {
      request.log.error({ msg: "Error fetching referral status:", err })
      const errTyped = toError(err)
      return reply.status(errTyped.message.includes("User not found") ? 404 : 400).send({ error: errTyped.message || "Failed to fetch referral status" })
    }
  })
}
