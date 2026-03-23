import { FastifyInstance } from "fastify"
import { leaderboardsSchema, pointsDetailsSchema, tasksSchema } from "../schemas/points.schema.js"
import { UserTasks, UserPoints } from "../types.js"
import { PointsService } from "../services/points.service.js"
import { toError } from "../utils.js"

export async function registerPointsProgramRoutes(fastify: FastifyInstance, opts: { pointsService: PointsService }) {
  fastify.get<UserTasks>("/tasks/:userAddress", tasksSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await opts.pointsService.getTasks(userAddress)

      return reply.status(200).send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user lp tasks" })
    }
  })

  fastify.get<UserPoints>("/points/:userAddress/:dateFrom", pointsDetailsSchema, async (request, reply) => {
    try {
      const { userAddress, dateFrom } = request.params
      const result = await opts.pointsService.getPointsDetails(userAddress, dateFrom)
      return reply.status(200).send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user points" })
    }
  })

  fastify.get<{ Params: { userAddress: string } }>("/leaderboards/:userAddress", leaderboardsSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const lpLeaderboard = await opts.pointsService.getLeaderBoards(userAddress)
      return reply.status(200).send(lpLeaderboard)
    } catch (err) {
      request.log.error({ msg: "Error processing leaderboards :", obj: err })
      const errTyped = toError(err)
      return reply.status(errTyped.message.includes("Invalid") ? 400 : 500).send({ error: errTyped.message })
    }
  })
}
