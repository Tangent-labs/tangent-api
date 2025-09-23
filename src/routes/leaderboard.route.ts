import { FastifyInstance } from "fastify"
import { godsonsLeaderboardSchema, leaderboardsSchema } from "./shemas"
import { LeaderboardService } from "../services/leaderboard.service"
import { Address } from "viem"

export async function registerLeaderboardRoutes(fastify: FastifyInstance, opts: { leaderboardService: LeaderboardService }) {
  fastify.get("/leaderboards", leaderboardsSchema, async (request, reply) => {
    try {
      const lpLeaderboard = await opts.leaderboardService.fetchLpLeaderboard()
      const voteLeaderboard = await opts.leaderboardService.fetchVoteLeaderboard()

      return reply.status(200).send({ lpLeaderboard, voteLeaderboard })
    } catch (err: any) {
      request.log.error("Error processing leaderboards :", err)
      return reply.status(err.message.includes("Invalid") ? 400 : 500).send({ error: err.message })
    }
  })

  fastify.get("/leaderboard/godsons/:address", godsonsLeaderboardSchema, async (request, reply) => {
    try {
      const { address } = request.params as { address: Address }

      const data = await opts.leaderboardService.fetchGodsonsLeaderboard(address)

      return reply.status(200).send(data)
    } catch (err: any) {
      request.log.error("Error processing godsons leaderboard :", err)
      return reply.status(err.message.includes("Invalid") ? 400 : 500).send({ error: err.message })
    }
  })
}
