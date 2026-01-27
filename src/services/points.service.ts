import { AddressLike } from "ethers"
import { PointsRepository } from "../data/points.data.js"

export class PointsService {
  pointsRepository: PointsRepository

  constructor(pointsRepository: PointsRepository) {
    this.pointsRepository = pointsRepository
  }

  computeLeaderboard(
    leaderboard: {
      rank: number
      address: AddressLike
      pts: number
    }[],
    userAddress: string
  ) {
    const userIndex = leaderboard.findIndex((el) => el?.address?.toString()?.toLowerCase() === userAddress?.toLowerCase())

    if (userIndex === -1 || userIndex < 10) {
      return leaderboard.slice(0, 10)
    }

    const top10 = leaderboard.slice(0, 10)
    const user = leaderboard[userIndex]

    return [...top10, user]
  }

  async fetchLpLeaderboard(userAddress: string) {
    const lpLeaderboard = await this.pointsRepository.fetchLpLeaderboard()
    const computedLeaderboard = this.computeLeaderboard(lpLeaderboard, userAddress)
    return computedLeaderboard
  }

  async fetchVoteLeaderboard(userAddress: string) {
    const voteLeaderboard = await this.pointsRepository.fetchVoteLeaderboard()
    const computedLeaderboard = this.computeLeaderboard(voteLeaderboard, userAddress)
    return computedLeaderboard
  }

  async fetchGodsonsLeaderboard(userAddress: AddressLike) {
    return await this.pointsRepository.fetchGodsonsLeaderboard(userAddress)
  }

  async getUserVoteTasks(userAddress: string) {
    try {
      const result = await this.pointsRepository.getUserVoteTasks(userAddress)
      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getUserTasks(userAddress: string) {
    try {
      const result = await this.pointsRepository.getUserTasks(userAddress)
      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getLpUserPoints(userAddress: string, dateFrom: string) {
    try {
      const result = await this.pointsRepository.getLpUserPoints(userAddress, dateFrom)

      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getVoteUserPoints(userAddress: string) {
    try {
      const result = await this.pointsRepository.getVoteUserPoints(userAddress)

      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getUserRefereesPoints(userAddress: string) {
    try {
      const result = await this.pointsRepository.getUserRefereesPoints(userAddress)

      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getUserBoosts(userAddress: string) {
    try {
      const result = await this.pointsRepository.getUserBoosts(userAddress)

      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getUserBoostMultiplicator(userAddress: string) {
    try {
      const result = await this.pointsRepository.getUserBoost(userAddress)

      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }
}
