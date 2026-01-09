import { PrismaClient } from "@prisma/client"
import { GodsonsLeaderboardItem, RawEvent, UserPointsRow, UserTaskRow, UserVoteTaskRow } from "../types.js"
import { AddressLike } from "ethers"

export class PointsRepository {
  prismaClient: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prismaClient = prisma
  }

  async getUserRefereesPoints(userAddress: string): Promise<{
    lpPoints: bigint
    votePoints: bigint
  }> {
    const address = userAddress.toLowerCase()

    const rows = await this.prismaClient.$queryRaw<Array<{ lp_points: bigint | null; vote_points: bigint | null }>>`
    WITH godfather AS (
      SELECT id
      FROM "global"."user"
      WHERE address = ${address}
      LIMIT 1
    ),
    godsons AS (
      SELECT u.id, u.address
      FROM "global"."referral_usages" ru
      JOIN "global"."user" u
        ON u.id = ru.godson_id
      WHERE ru.godfather_id = (SELECT id FROM godfather)
    ),
    referrals AS (
      SELECT
        COALESCE(SUM(u.lp_referral_points), 0)   AS lp_referral_points,
        COALESCE(SUM(u.vote_referral_points), 0) AS vote_referral_points
      FROM "global"."user" u
      WHERE u.id IN (SELECT id FROM godsons)
    ),
    lp AS (
      SELECT
        COALESCE(SUM(p.points + p.booster_points), 0) AS lp_points
      FROM "points"."lp_user_points" p
      WHERE p.user_address IN (SELECT address FROM godsons)
    ),
    vt AS (
      SELECT
        COALESCE(SUM(v.points), 0) AS vote_points
      FROM "points"."vote_user_tasks" v
      WHERE v.user_address IN (SELECT address FROM godsons)
    )
    SELECT
      lp.lp_points + rt.lp_referral_points      AS lp_points,
      vt.vote_points + rt.vote_referral_points  AS vote_points
    FROM lp
    CROSS JOIN vt
    CROSS JOIN referrals rt;
  `

    const lpPoints = rows?.[0]?.lp_points ?? 0n
    const votePoints = rows?.[0]?.vote_points ?? 0n

    return { lpPoints, votePoints }
  }

  async getVoteUserPoints(userAddress: string): Promise<{
    voteTotalPoints: bigint
  }> {
    const addr = userAddress.toLowerCase()

    const computedPoints = await this.prismaClient.$queryRaw<UserPointsRow[]>`
    WITH base AS (
      SELECT COALESCE(SUM(up.points), 0)::bigint AS base_points
      FROM points.vote_user_tasks up
      WHERE up.user_address = ${addr}
    )
    SELECT
      b.base_points,
      COALESCE(u.vote_referral_points, 0)::bigint AS vote_referral_points,
      b.base_points + COALESCE(u.vote_referral_points, 0)::bigint AS total_points
    FROM base b
    LEFT JOIN "global"."user" u
      ON u.address = ${addr}
    LIMIT 1;
  `

    const totals = computedPoints[0] ?? {
      base_points: 0n,
      referral_points: 0n,
      total_points: 0n,
    }

    return { voteTotalPoints: totals?.total_points }
  }

  async getLpUserPoints(
    userAddress: string,
    now: string
  ): Promise<{
    lpTotalPoints: bigint
    lpDailyRate: bigint
  }> {
    const addr = userAddress.toLowerCase()

    const rows = await this.prismaClient.$queryRaw<{ total_points: bigint; daily_rate: bigint }[]>`
  WITH base AS (
    SELECT COALESCE(SUM(up.points), 0)::bigint AS base_points
    FROM points.lp_user_points up
    WHERE up.user_address = ${addr}
  ),
  boosted AS (
    SELECT COALESCE(SUM(up.booster_points), 0)::bigint AS boosted_points
    FROM points.lp_user_points up
    WHERE up.user_address = ${addr}
  ),
  referral AS (
    SELECT COALESCE(u.lp_referral_points, 0)::bigint AS referral_points
    FROM "global"."user" u
    WHERE u.address = ${addr}
    LIMIT 1
  ),
  open_tasks AS (
    SELECT
      ut.amount,
      t.point_rate::numeric   AS point_rate,
      t.price_source_id       AS price_source_id
    FROM points.lp_user_tasks ut
    JOIN points.lp_task t ON t.id = ut.task_id
    WHERE ut.user_address = ${addr}
      AND ut.closed IS NULL
  ),
  per_task AS (
    SELECT
      (ot.amount::numeric / 1e18)        AS amount_tokens,
      COALESCE(pf.price_usd::numeric, 0) AS price_usd,
      ot.point_rate                      AS point_rate
    FROM open_tasks ot
    LEFT JOIN LATERAL (
      SELECT pf.price_usd
      FROM points.price_feeds pf
      WHERE pf.price_source_id = ot.price_source_id
        AND pf.timestamp <= ${now}::timestamp
      ORDER BY pf.timestamp DESC
      LIMIT 1
    ) pf ON TRUE
  ),
  daily AS (
    SELECT
      COALESCE(
        ROUND(
          SUM(amount_tokens * price_usd * 86400 * point_rate)
        ), 0
      )::bigint AS daily_rate
    FROM per_task
  )
  SELECT
    (SELECT base_points FROM base)
    + COALESCE((SELECT referral_points FROM referral), 0)::bigint
    + COALESCE((SELECT boosted_points FROM boosted), 0)::bigint
    AS total_points,
    (SELECT daily_rate FROM daily) AS daily_rate;
  `

    const totalPoints = rows[0]?.total_points ?? 0n
    const dailyRate = rows[0]?.daily_rate ?? 0n

    return {
      lpTotalPoints: totalPoints,
      lpDailyRate: dailyRate,
    }
  }

  async getUserVoteTasks(userAddress: string): Promise<UserVoteTaskRow[]> {
    const addr = userAddress.toLowerCase()

    const rows = await this.prismaClient.$queryRaw<UserVoteTaskRow[]>`
    WITH agg AS (
      SELECT
        vote_task_id,
        COUNT(*)::bigint                         AS cnt,
        COALESCE(SUM(points), 0)::bigint         AS points_sum
      FROM points.vote_user_tasks
      WHERE user_address = ${addr}
      GROUP BY vote_task_id
    )
    SELECT
      t.id::bigint                               AS "taskId",
      t.organisation                             AS "organisation",
      t.protocol                                 AS "protocol",
      t.url                                      AS "url",
      t.description                              AS "description",
      t.point_rate                               AS "pointRate",
      (COALESCE(agg.cnt, 0) > 0)                 AS "status",
      COALESCE(agg.points_sum, 0)::bigint        AS "points"
    FROM points.vote_task t
    LEFT JOIN agg ON agg.vote_task_id = t.id
    ORDER BY t.id;
  `

    return rows
  }

  async getUserTasks(userAddress: string): Promise<UserTaskRow[]> {
    const addr = userAddress.toLowerCase()

    const rows = await this.prismaClient.$queryRaw<UserTaskRow[]>`
  WITH ut_open AS (
    SELECT task_id, COUNT(*) AS open_count
    FROM points.lp_user_tasks
    WHERE user_address = ${addr}
      AND closed IS NULL
    GROUP BY task_id
  ),
  up_sum AS (
    SELECT task_id, points AS points_sum
    FROM points.lp_user_points
    WHERE user_address = ${addr}
  )
  SELECT
    t.id                  AS "taskId",
    t.name                AS "asset",
    t.protocol            AS "protocol",
    t.url                 AS "url",
    t.description         AS "description",
    t.point_rate          AS "pointRate",
    t.token_address       AS "tokenAddress",
    lpf.price_usd         AS "priceUSD",
    (ut_open.open_count > 0)             AS "status",
    COALESCE(up_sum.points_sum, 0)       AS "points"
  FROM points.lp_task t
  INNER JOIN points.last_price_feeds AS lpf ON lpf.price_source_id = t.price_source_id
  LEFT JOIN  ut_open                        ON ut_open.task_id = t.id
  LEFT JOIN  up_sum                         ON up_sum.task_id  = t.id
  ORDER BY t.id;
`

    let totalDebtPoints = 0n
    let pointRate = 0
    let status = false

    rows.forEach((r) => {
      if (r.description.includes("debt on")) {
        if (r.points !== 0n) {
          totalDebtPoints += r.points
          status = true
        }
        pointRate = r.pointRate
      }
    })

    const finalTasks: UserTaskRow[] = [
      {
        taskId: 0,
        asset: "USG",
        url: "https://tangent-dapp.vercel.app/",
        protocol: "tangent",
        description: "Have some debt",
        pointRate: pointRate,
        status: status,
        points: totalDebtPoints,
      },
      ...rows.filter((r) => !r.description.includes("debt on")),
    ]

    return finalTasks
  }

  async getUserBoosts(userAddress: string): Promise<string[]> {
    const address = userAddress.toLowerCase()

    const [offchainBoosts, onchainBoosts] = await Promise.all([
      this.prismaClient.offchain_boost_user.findMany({
        where: { user_address: address },
        select: { type: true },
      }),
      this.prismaClient.onchain_boost_user.findMany({
        where: { user_address: address },
        select: { type: true },
      }),
    ])

    const boostNames = [...offchainBoosts.map((b) => b.type), ...onchainBoosts.map((b) => b.type)]

    return boostNames
  }

  async fetchLpLeaderboard() {
    const rows = await this.prismaClient.$queryRaw<{ user_address: string; pts: bigint }[]>`
      SELECT user_address, pts
      FROM points.view_leaderboard_lp
      ORDER BY pts DESC, user_address ASC;
    `

    return rows.map((r, i) => ({
      rank: i + 1,
      address: r.user_address as AddressLike,
      pts: Number(r.pts),
    }))
  }

  async fetchVoteLeaderboard() {
    const rows = await this.prismaClient.$queryRaw<{ user_address: string; pts: bigint }[]>`
      SELECT user_address, pts
      FROM points.view_leaderboard_vote
      ORDER BY pts DESC, user_address ASC;
    `

    return rows.map((r, i) => ({
      rank: i + 1,
      address: r.user_address as AddressLike,
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
  async fetchGodsonsLeaderboard(userAddress: AddressLike): Promise<GodsonsLeaderboardItem[]> {
    const rows = await this.prismaClient.$queryRaw<{ rank: number; address: string; lpPoints: bigint; votePts: bigint }[]>`
      WITH godsons AS (
        SELECT gs."address"
        FROM "global"."user" gf
        JOIN "global"."referral_usages" ru
          ON ru."godfather_id" = gf."id"
        JOIN "global"."user" gs
          ON gs."id" = ru."godson_id"
        WHERE gf."address" = ${userAddress.toString()}
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
      address: r.address as AddressLike,
      lpPoints: Number(r.lpPoints),
      votePts: Number(r.votePts),
    }))
  }
}
