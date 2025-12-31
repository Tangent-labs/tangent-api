import { AddressLike } from "ethers"
import { PointsRepository } from "../data/points.data.js"


export class PointsService {
  pointsRepository: PointsRepository

  constructor(pointsRepository: PointsRepository) {
    this.pointsRepository = pointsRepository
  }

  async fetchLpLeaderboard() {
    const leaderboard = await this.pointsRepository.fetchLpLeaderboard()
    return leaderboard.filter((_, index) => index < 10)
  }

  async fetchVoteLeaderboard() {
    const leaderboard = await this.pointsRepository.fetchVoteLeaderboard()
    return leaderboard.filter((_, index) => index < 10)
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
}
