import { FastifyInstance, FastifyRequest } from "fastify"
import { predepositFrontSchema, signPredepositSchema } from "../schemas/predeposit.schema.js"
import { PredepositService } from "../services/predeposit.service.js"
import { AddressLike } from "ethers"


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
        } catch (err: any) {
            request.log.error(`Error retrieving predeposit front end data for ${userAddress} with : ${err}`)
            return reply.status(err.message.includes("Invalid") ? 400 : 500).send({ error: err.message })
        }
    })

    // Predeposit Signaure endpoint
    fastify.post<PredepositRoute>("/predeposit/sign", signPredepositSchema, async (request: FastifyRequest<PredepositRoute>, reply) => {
        try {
            const result = await opts.predepositService.verifyAndStoreSignature(request.body)
            return reply.status(200).send(result)
        } catch (err: any) {
            request.log.error("Error processing signature predeposit :", err.toString())
            return reply.status(err.message.includes("Invalid") || err.message.includes("already") ? 400 : 500).send({ error: err.message })
        }
    })


}
