import { FastifyInstance, FastifyRequest } from "fastify"
import { predepositFrontSchema, signPredepositSchema } from "../schemas/predeposit.schema.js"
import { PredepositService } from "../services/predeposit.service.js"
import { AddressLike } from "ethers"
import { toError } from "../utils.js"

export interface PredepositInput {
  signature: string
  account: string
  now: string
}
interface PredepositRoute {
  Body: PredepositInput
}

export async function registerPredepositRoutes(fastify: FastifyInstance, opts: { predepositService: PredepositService }) {
  // Retrieve front-end data
  fastify.get("/predeposit/:userAddress", predepositFrontSchema, async (request, reply) => {
    const { userAddress } = request.params as { userAddress: AddressLike }
    try {
      const predepositFrontData = await opts.predepositService.fetchFrontData(userAddress)
      return reply.status(200).send(predepositFrontData)
    } catch (err) {
      const errTyped = toError(err)
      request.log.error(`Error retrieving predeposit front end data for ${userAddress} with : ${err}`)
      return reply.status(errTyped.message.includes("Invalid") ? 400 : 500).send({ error: errTyped.message })
    }
  })

  // Predeposit Signaure endpoint
  fastify.post<PredepositRoute>("/predeposit/sign", signPredepositSchema, async (request: FastifyRequest<PredepositRoute>, reply) => {
    try {
      const result = await opts.predepositService.verifyAndStoreSignature(request.body)
      return reply.status(200).send(result)
    } catch (err) {
      request.log.error({ msg: "Error processing signature predeposit :", err })

      const errTyped = toError(err)
      return reply.status(errTyped.message.includes("Invalid") ? 400 : 500).send({ error: errTyped.message })
    }
  })
}
