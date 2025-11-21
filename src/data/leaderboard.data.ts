import { Address } from "viem"
import { PrismaClient } from "@prisma/client"
import { GodsonsLeaderboardItem } from "../types.js"

export class LeaderboardRepository {
  prismaClient: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prismaClient = prisma
  }

  async fetchLpLeaderboard() {
    const rows = await this.prismaClient.$queryRaw<{ user_address: string; pts: bigint }[]>`
      SELECT user_address, pts
      FROM points.view_leaderboard_lp
      ORDER BY pts DESC, user_address ASC;
  `

    return rows.map((r, i) => ({
      rank: i + 1,
      address: r.user_address as Address,
      pts: Number(r.pts),
    }))
  }

  async fetchVoteLeaderboard() {
    const rows = await this.prismaClient.$queryRaw<{ user_address: string; pts: bigint }[]>`
      SELECT user_address, pts FROM points.view_leaderboard_vote;
    `

    return rows.map((r, i) => ({
      rank: i + 1,
      address: r.user_address as Address,
      pts: Number(r.pts),
    }))
  }

  /**
   *
   * @param userAddress users address to fetch his top 5 godsons by total points (lp + vote)
   * Retrieves godsons addresses using referral_usages and user tables
   * Sum each godson’s liquidity points
   * Sum each godson’s vote points
   * Combine points
   * Set the rank
   */
  async fetchGodsonsLeaderboard(userAddress: Address): Promise<GodsonsLeaderboardItem[]> {
    const rows = await this.prismaClient.$queryRaw<{ rank: number; address: string; lpPoints: bigint; votePts: bigint }[]>`
      WITH godsons AS (
        SELECT gs."address"
        FROM "global"."user" gf
        JOIN "global"."referral_usages" ru
          ON ru."godfather_id" = gf."id"
        JOIN "global"."user" gs
          ON gs."id" = ru."godson_id"
        WHERE gf."address" = ${userAddress}
      ),
      lp AS (
        SELECT u."address" AS user_address,
               (COALESCE(SUM(up."points"), 0) + COALESCE(SUM(up."booster_points"), 0) + COALESCE(u."lp_referral_points", 0))::bigint AS lp_pts
        FROM "global"."user" u
        LEFT JOIN "points"."lp_user_points" up
          ON up."user_address" = u."address"
        WHERE u."address" IN (SELECT "address" FROM godsons)
        GROUP BY u."address", u."lp_referral_points"
      ),
      vote AS (
        SELECT u."address" AS user_address,
               (COALESCE(SUM(vt."points"), 0) + COALESCE(u."vote_referral_points", 0))::bigint AS vote_pts
        FROM "global"."user" u
        LEFT JOIN "points"."vote_user_tasks" vt
          ON vt."user_address" = u."address"
        WHERE u."address" IN (SELECT "address" FROM godsons)
        GROUP BY u."address", u."vote_referral_points"
      ),
      merged AS (
        SELECT g."address",
               COALESCE(lp.lp_pts, 0)::bigint   AS lp_pts,
               COALESCE(vote.vote_pts, 0)::bigint AS vote_pts
        FROM godsons g
        LEFT JOIN lp   ON lp."user_address"   = g."address"
        LEFT JOIN vote ON vote."user_address" = g."address"
      ),
      ranked AS (
        SELECT
          "address",
          lp_pts,
          vote_pts,
          ROW_NUMBER() OVER (ORDER BY (lp_pts + vote_pts) DESC, "address" ASC) AS rank
        FROM merged
      )
      SELECT
        rank,
        "address",
        lp_pts   AS "lpPoints",
        vote_pts AS "votePts"
      FROM ranked
      ORDER BY rank
      LIMIT 5;
    `

    return rows.map((r) => ({
      rank: r.rank,
      address: r.address as Address,
      lpPoints: Number(r.lpPoints),
      votePts: Number(r.votePts),
    }))
  }
}
