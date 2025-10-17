import { Address } from "viem"
import { LeaderboardRepository } from "../data/leaderboard.data.js"

export class LeaderboardService {
  leaderboardRepository: LeaderboardRepository

  constructor(leaderboardRepo: LeaderboardRepository) {
    this.leaderboardRepository = leaderboardRepo
  }

  async fetchLpLeaderboard() {
    return await this.leaderboardRepository.fetchLpLeaderboard()
  }

  async fetchVoteLeaderboard() {
    return await this.leaderboardRepository.fetchVoteLeaderboard()
  }

  async fetchGodsonsLeaderboard(userAddress: Address) {
    return await this.leaderboardRepository.fetchGodsonsLeaderboard(userAddress)
  }
}
