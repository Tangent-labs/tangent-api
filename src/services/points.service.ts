import { PointsRepository } from "../data/points.data.js"
import { GodsonsLeaderboardItem, LeaderBoardPosition, LpUserPointsResult, UserTaskRow, UserVoteTaskRow } from "../types.js";

export class PointsService {
  pointsRepository: PointsRepository

  constructor(pointsRepository: PointsRepository) {
    this.pointsRepository = pointsRepository
  }

  computeLeaderboard(
    leaderboard: LeaderBoardPosition[],
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

  async getLeaderBoards(userAddress: string) {
    let lpLeaderboard: LeaderBoardPosition[] = []
    let voteLeaderboard: LeaderBoardPosition[] = []
    let godsonsLeaderboard: GodsonsLeaderboardItem[] = []

    try {
      lpLeaderboard = this.computeLeaderboard(await this.pointsRepository.fetchLpLeaderboard(), userAddress)
    } catch (err) {
      console.log(err)
    }
    try {
      voteLeaderboard = this.computeLeaderboard(await this.pointsRepository.fetchVoteLeaderboard(), userAddress)
    } catch (err) {
      console.log(err)
    }
    try {
      godsonsLeaderboard = await this.pointsRepository.fetchGodsonsLeaderboard(userAddress)
    } catch (err) {
      console.log(err)
    }

    return {
      lp: lpLeaderboard,
      vote: voteLeaderboard,
      godsons: godsonsLeaderboard
    }
  }

  async getTasks(userAddress: string) {
    let lpTasks: UserTaskRow[] = []
    let voteTasks: UserVoteTaskRow[] = []
    try {
      lpTasks = await this.pointsRepository.getUserTasks(userAddress)
    } catch (err) {
      console.log(err)
    }
    try {
      voteTasks = await this.pointsRepository.getUserVoteTasks(userAddress)
    } catch (err) {
      console.log(err)
    }

    return {
      lp: lpTasks,
      vote: voteTasks
    }
  }

  async getPointsDetails(userAddress: string, dateFrom: string) {
    let lpPointsResult: LpUserPointsResult = { lpDailyRate: "", lpTotalPoints: "" }
    let totalVotePoints = ""
    let refereesPoints = { lp: "", vote: "" }

    try {
      lpPointsResult = await this.pointsRepository.getLpUserPoints(userAddress, dateFrom)
    } catch (err) {
      console.log(err)
    }

    try {
      totalVotePoints = await this.pointsRepository.getVoteUserPoints(userAddress)
    } catch (err) {
      console.log(err)
    }

    try {
      refereesPoints = await this.pointsRepository.getUserRefereesPoints(userAddress)
    } catch (err) {
      console.log(err)
    }

    let boost = 1
    try {
      boost = await this.pointsRepository.getUserBoost(userAddress)
    } catch (err) {
      console.log(err)
    }

    return {
      boost: boost,
      lp: {
        total: lpPointsResult.lpTotalPoints,
        referees: refereesPoints.lp,
        dailyRate: lpPointsResult.lpDailyRate
      },
      vote: {
        total: totalVotePoints,
        referees: refereesPoints.vote,
      }
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
