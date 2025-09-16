import { FastifyInstance } from "fastify"
import { leaderboardsSchema } from "./shemas"
import { LeaderboardService } from "../services/leaderboard.service"

export async function registerLeaderboardRoutes(fastify: FastifyInstance, opts: { leaderboardService: LeaderboardService }) {
  fastify.get("/leaderboards", leaderboardsSchema, async (request, reply) => {
    try {
      const lpLeaderboard = await opts.leaderboardService.fetchLpLeaderboard()
      const voteLeaderboard = await opts.leaderboardService.fetchVoteLeaderboard()

      return reply.status(200).send({ lpLeaderboard, voteLeaderboard })
    } catch (err: any) {
      request.log.error("Error processing lp leaderboard :", err)
      return reply.status(err.message.includes("Invalid") ? 400 : 500).send({ error: err.message })
    }
  })
}
