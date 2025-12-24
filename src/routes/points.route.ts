import { FastifyInstance } from "fastify"
import { boostsPointsSchema, godsonsLeaderboardSchema, leaderboardsSchema, lpPointsSchema, refereesPointsSchema, userTasksSchema, votePointsSchema } from "../schemas/points.schema.js"
import { UserTasks, UserPoints } from "../types.js"
import { PointsService } from "../services/points.service.js"
import { AddressLike } from "ethers"


export async function registerPointsProgramRoutes(fastify: FastifyInstance, opts: { pointsService: PointsService }) {
  fastify.get<UserTasks>("/tasks/:userAddress", userTasksSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await opts.pointsService.getUserTasks(userAddress)

      return reply.status(200).send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user lp tasks" })
    }
  })

  fastify.get<UserTasks>("/tasks/vote/:userAddress", userTasksSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await opts.pointsService.getUserVoteTasks(userAddress)
      return reply.status(200).send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user vote tasks" })
    }
  })

  fastify.get<UserPoints>("/lp-points/:userAddress/:dateFrom", lpPointsSchema, async (request, reply) => {
    try {
      const { userAddress, dateFrom } = request.params
      const result = await opts.pointsService.getLpUserPoints(userAddress, dateFrom)
      return reply.status(200).send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user points" })
    }
  })

  fastify.get<UserPoints>("/vote-points/:userAddress", votePointsSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await opts.pointsService.getVoteUserPoints(userAddress)
      return reply.status(200).send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user points" })
    }
  })

  fastify.get<UserPoints>("/refereess/points/:userAddress", refereesPointsSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await opts.pointsService.getUserRefereesPoints(userAddress)
      return reply.status(200).send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user points" })
    }
  })

  fastify.get<{ Params: { userAddress: string } }>("/boosts/:userAddress", boostsPointsSchema, async (request, reply) => {
    try {
      const { userAddress } = request.params
      const result = await opts.pointsService.getUserBoosts(userAddress)

      return reply.status(200).send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: "Failed to fetch user points" })
    }
  })

  fastify.get("/leaderboards", leaderboardsSchema, async (request, reply) => {
    try {
      const lpLeaderboard = await opts.pointsService.fetchLpLeaderboard()
      const voteLeaderboard = await opts.pointsService.fetchVoteLeaderboard()

      return reply.status(200).send({ lpLeaderboard, voteLeaderboard })
    } catch (err: any) {
      request.log.error("Error processing leaderboards :", err)
      return reply.status(err.message.includes("Invalid") ? 400 : 500).send({ error: err.message })
    }
  })

  fastify.get("/leaderboard/godsons/:address", godsonsLeaderboardSchema, async (request, reply) => {
    try {
      const { address } = request.params as { address: AddressLike }

      const data = await opts.pointsService.fetchGodsonsLeaderboard(address)

      return reply.status(200).send(data)
    } catch (err: any) {
      request.log.error("Error processing godsons leaderboard :", err)
      return reply.status(err.message.includes("Invalid") ? 400 : 500).send({ error: err.message })
    }
  })
}
