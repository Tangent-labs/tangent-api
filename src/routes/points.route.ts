import { FastifyInstance } from "fastify"
import {
  boostsPointsSchema,
  godsonsLeaderboardSchema,
  leaderboardsSchema,
  lpPointsSchema,
  refereesPointsSchema,
  userTasksSchema,
  votePointsSchema,
} from "../schemas/points.schema.js"
import { UserTasks, UserPoints } from "../types.js"
import { PointsService } from "../services/points.service.js"
import { AddressLike } from "ethers"
import { toError } from "../utils.js"

export async function registerPointsProgramRoutes(fastify: FastifyInstance, opts: { pointsService: PointsService }) {
  fastify.get<UserTasks>("/tasks/:userAddress", userTasksSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await opts.pointsService.getUserTasks(userAddress)

      return reply.status(200).send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user lp tasks" })
    }
  })

  fastify.get<UserTasks>("/tasks/vote/:userAddress", userTasksSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await opts.pointsService.getUserVoteTasks(userAddress)
      return reply.status(200).send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user vote tasks" })
    }
  })

  fastify.get<UserPoints>("/lp-points/:userAddress/:dateFrom", lpPointsSchema, async (request, reply) => {
    try {
      const { userAddress, dateFrom } = request.params
      const result = await opts.pointsService.getLpUserPoints(userAddress, dateFrom)
      return reply.status(200).send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user points" })
    }
  })

  fastify.get<UserPoints>("/vote-points/:userAddress", votePointsSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await opts.pointsService.getVoteUserPoints(userAddress)
      return reply.status(200).send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user points" })
    }
  })

  fastify.get<UserPoints>("/refereess/points/:userAddress", refereesPointsSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await opts.pointsService.getUserRefereesPoints(userAddress)
      return reply.status(200).send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user points" })
    }
  })

  fastify.get<{ Params: { userAddress: string } }>("/boosts/:userAddress", boostsPointsSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await opts.pointsService.getUserBoosts(userAddress)
      const boost = await opts.pointsService.getUserBoostMultiplicator(userAddress)

      return reply.status(200).send({ result, boost })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user boosts" })
    }
  })

  fastify.get<{ Params: { userAddress: string } }>("/leaderboards/:userAddress", leaderboardsSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params

      const lpLeaderboard = await opts.pointsService.fetchLpLeaderboard(userAddress)
      const voteLeaderboard = await opts.pointsService.fetchVoteLeaderboard(userAddress)

      return reply.status(200).send({ lpLeaderboard, voteLeaderboard })
    } catch (err) {
      request.log.error({ msg: "Error processing leaderboards :", obj: err })
      const errTyped = toError(err)
      return reply.status(errTyped.message.includes("Invalid") ? 400 : 500).send({ error: errTyped.message })
    }
  })

  fastify.get("/leaderboard/godsons/:address", godsonsLeaderboardSchema, async (request, reply) => {
    try {
      const { address } = request.params as { address: AddressLike }

      const data = await opts.pointsService.fetchGodsonsLeaderboard(address)

      return reply.status(200).send(data)
    } catch (err) {
      request.log.error({ msg: "Error processing godsons leaderboard :", err })
      const errTyped = toError(err)
      return reply.status(errTyped.message.includes("Invalid") ? 400 : 500).send({ error: errTyped.message })
    }
  })
}
