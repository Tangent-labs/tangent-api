import { AddressLike } from "ethers"
import { PointsRepository } from "../data/points.data.js"

export class PointsService {
  pointsRepository: PointsRepository

  constructor(pointsRepository: PointsRepository) {
    this.pointsRepository = pointsRepository
  }

  async fetchLpLeaderboard(userAddress: string) {
    const fullLeaderboard = await this.pointsRepository.fetchLpLeaderboard()

    const userIndex = fullLeaderboard.findIndex((el) => el?.address?.toString()?.toLowerCase() === userAddress?.toLowerCase())

    if (userIndex === -1 || userIndex < 10) {
      return fullLeaderboard.slice(0, 10)
    }

    const top10 = fullLeaderboard.slice(0, 10)
    const user = fullLeaderboard[userIndex]

    return [...top10, user]
  }

  async fetchVoteLeaderboard(userAddress: string) {
    const fullLeaderboard = await this.pointsRepository.fetchVoteLeaderboard()

    const userIndex = fullLeaderboard.findIndex((el) => el?.address?.toString()?.toLowerCase() === userAddress?.toLowerCase())

    if (userIndex === -1 || userIndex < 10) {
      return fullLeaderboard.slice(0, 10)
    }

    const top10 = fullLeaderboard.slice(0, 10)
    const user = fullLeaderboard[userIndex]

    return [...top10, user]
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
