import { Address } from "viem"
import { LeaderboardRepository } from "../data/leaderboard.data.js"

export class LeaderboardService {
  leaderboardRepository: LeaderboardRepository

  constructor(leaderboardRepo: LeaderboardRepository) {
    this.leaderboardRepository = leaderboardRepo
  }

  async fetchLpLeaderboard() {
    const leaderboard = await this.leaderboardRepository.fetchLpLeaderboard()
    return leaderboard.filter((_, index) => index < 10)
  }

  async fetchVoteLeaderboard() {
    const leaderboard = await this.leaderboardRepository.fetchVoteLeaderboard()
    return leaderboard.filter((_, index) => index < 10)
  }

  async fetchGodsonsLeaderboard(userAddress: Address) {
    return await this.leaderboardRepository.fetchGodsonsLeaderboard(userAddress)
  }
}
