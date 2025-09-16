import { Address } from "viem"
import { PrismaClient } from "@prisma/client"

export class LeaderboardRepository {
  prismaClient: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prismaClient = prisma
  }

  async fetchLpLeaderboard() {
    const rows = await this.prismaClient.$queryRaw<{ user_address: string; pts: bigint }[]>`
    SELECT "user_address",
           SUM(COALESCE("points", 0) + COALESCE("booster_points", 0)) AS pts
    FROM "points"."user_points"
    GROUP BY "user_address"
    ORDER BY pts DESC
    LIMIT 5;
  `

    console.log("rows : ", rows)

    return rows.map((r, i) => ({
      rank: i + 1,
      address: r.user_address as Address,
      pts: Number(r.pts),
    }))
  }

  async fetchVoteLeaderboard() {
    const rows = await this.prismaClient.$queryRaw<{ user_address: string; pts: bigint }[]>`
        SELECT "user_address",
               SUM(COALESCE("points", 0)) AS pts
        FROM "points"."user_vote_tasks"
        GROUP BY "user_address"
        ORDER BY pts DESC
        LIMIT 5;
      `

    return rows.map((r, i) => ({
      rank: i + 1,
      address: r.user_address as Address,
      pts: Number(r.pts),
    }))
  }
}
