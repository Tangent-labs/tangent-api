import { isAddress } from "viem"
import { AddressLike } from "ethers"
import { PrismaClient } from "@prisma/client"

import { rangeToMinDate } from "../utils.js"
import { RawEvent, UserPointsRow, UserTaskRow, UserVoteTaskRow } from "../types.js"

export class EventRepository {
  prismaClient: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prismaClient = prisma
  }

  async getEventsByAccount(account: string, market: string): Promise<RawEvent[]> {
    if (!isAddress(account) || !isAddress(market)) {
      throw new Error("Invalid account or market address")
    }

    const marketResult = await this.prismaClient.$queryRaw<{ id: string }[]>`
      SELECT id FROM events.usg_markets WHERE LOWER(contract_address) = LOWER(${market})
    `
    if (marketResult.length === 0) throw new Error(`No market found for contract_address: ${market}`)

    const market_id = marketResult[0].id

    const rows = await this.prismaClient.$queryRaw<RawEvent[]>`
      SELECT 'borrow' AS label, '0' AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.borrow WHERE account = ${account} AND market_id = ${market_id}
      UNION ALL
      SELECT 'deposit' AS label, staked_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
      FROM events.deposit WHERE account = ${account} AND market_id = ${market_id}
      UNION ALL
      SELECT 'zap_deposit' AS label, staked_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_deposit WHERE account = ${account} AND market_id = ${market_id}
      UNION ALL
      SELECT 'deposit_and_borrow' AS label, staked_amount AS collat_amount, borrow_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.deposit_and_borrow WHERE account = ${account} AND market_id = ${market_id}
      UNION ALL
      SELECT 'zap_deposit_and_borrow' AS label, staked_amount AS collat_amount, borrow_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_deposit_and_borrow WHERE account = ${account} AND market_id = ${market_id}
      UNION ALL
      SELECT 'withdraw' AS label, withdrawn_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
      FROM events.withdraw WHERE account = ${account} AND market_id = ${market_id}
      UNION ALL
      SELECT 'repay' AS label, '0' AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.repay WHERE account = ${account} AND market_id = ${market_id}
      UNION ALL
      SELECT 'repay_and_withdraw' AS label, withdrawn_amount AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.repay_and_withdraw WHERE account = ${account} AND market_id = ${market_id}
      UNION ALL
      SELECT 'zap_repay' AS label, '0' AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_repay WHERE account = ${account} AND market_id = ${market_id}
      UNION ALL
      SELECT 'zap_repay_and_withdraw' AS label, withdrawn_amount AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_repay_and_withdraw WHERE account = ${account} AND market_id = ${market_id}
      UNION ALL
      SELECT 'leverage' AS label, staked_amount AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.leverage WHERE account = ${account} AND market_id = ${market_id}
      UNION ALL
      SELECT 'zap_leverage' AS label, staked_amount AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_leverage WHERE account = ${account} AND market_id = ${market_id}
      UNION ALL
      SELECT 'liquidate' AS label, collateral_liquidated AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.liquidate WHERE account = ${account} AND market_id = ${market_id}
      UNION ALL
      SELECT 'self_liquidate' AS label, collateral_liquidated AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.self_liquidate WHERE account = ${account} AND market_id = ${market_id}
      ORDER BY date DESC
    `
    return rows
  }

  /**
   * @param marketAddress marketAddress provided by the frontend
   * @param dateFrom ISO date/time from the frontend (trusted block time)
   * @param range '1w' | '1m' | '1y' | 'all'
   * @param rowAmounts max number of points displayed in the graph
   */
  async getHistoricalData(marketAddress: AddressLike, dateFrom: string, range: string, rowAmounts: number = 100) {
    const minDate = rangeToMinDate(range, dateFrom) // always a string (incl. for "all")

    const chartData = await this.prismaClient.$queryRaw<any[]>`
  WITH filtered_data AS (
    SELECT mgd.id, mgd.timestamp, mgd.tvl_usd, mgd.total_debt, mgd.ir_apy, um.contract_address, mgd.apr_current
    FROM global.market_global_data AS mgd
    JOIN events.usg_markets AS um ON mgd.market_id = um.id
    WHERE um.contract_address = ${marketAddress}
      -- mgd.timestamp is timestamp WITHOUT time zone; interpret it as UTC
      AND (mgd.timestamp AT TIME ZONE 'UTC') > ${minDate}::timestamptz
  ),
  row_ratio AS (
    SELECT CEIL(COUNT(*) / ${rowAmounts}) AS ratio
    FROM filtered_data
  )
  SELECT timestamp, tvl_usd, total_debt, ir_apy, apr_current
  FROM (
    SELECT id, timestamp, tvl_usd, total_debt, ir_apy, apr_current,
           ROW_NUMBER() OVER (ORDER BY id DESC) AS rn
    FROM filtered_data
  ) x
  CROSS JOIN row_ratio
  ORDER BY id ASC;
`

    return chartData
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
      t.name                                     AS "name",
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

    let rows = await this.prismaClient.$queryRaw<UserTaskRow[]>`
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
    (ut_open.open_count > 0)             AS "status",
    COALESCE(up_sum.points_sum, 0)       AS "points"
  FROM points.lp_task t
  LEFT JOIN ut_open  ON ut_open.task_id = t.id
  LEFT JOIN up_sum   ON up_sum.task_id  = t.id
  ORDER BY t.id;
`

    let totalDebtPoints = 0n;
    let pointRate = 0;
    let status = false;

    rows.forEach(r => {
      if (r.description.includes("debt on")) {
        totalDebtPoints += r.points;
        pointRate = r.pointRate;
        status = true;
      }
    });


    const finalTasks = [
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
    ];
    return finalTasks
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
      SELECT u.address
      FROM "global"."referral_usages" ru
      JOIN "global"."user" u
        ON u.id = ru.godson_id
      WHERE ru.godfather_id = (SELECT id FROM godfather)
    ),
    lp AS (
      SELECT COALESCE(SUM(points) + SUM(booster_points), 0) AS lp_points
      FROM "points"."lp_user_points"
      WHERE user_address IN (SELECT address FROM godsons)
    ),
    vt AS (
      SELECT COALESCE(SUM(points), 0) AS vote_points
      FROM "points"."vote_user_tasks"
      WHERE user_address IN (SELECT address FROM godsons)
    )
    SELECT lp.lp_points, vt.vote_points
    FROM lp CROSS JOIN vt;
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
    referral AS (
      SELECT COALESCE(u.lp_referral_points, 0)::bigint AS referral_points
      FROM "global"."user" u
      WHERE u.address = ${addr}
      LIMIT 1
    ),
    boost AS (
      SELECT COALESCE((
        SELECT ub.multiplier::numeric
        FROM points.user_boost ub
        WHERE ub.user_address = ${addr}
          AND ub.start_at <= ${now}::timestamp
          AND (ub.end_at IS NULL)
        ORDER BY ub.start_at DESC
        LIMIT 1
      ), 1.00::numeric) AS m
    ),
    open_tasks AS (
      SELECT
        ut.amount,
        t.point_rate::numeric   AS point_rate,
        t.token_address::text   AS token_address
      FROM points.lp_user_tasks ut
      JOIN points.lp_task t ON t.id = ut.task_id
      WHERE ut.user_address = ${addr}
        AND ut.closed IS NULL
    ),
    per_task AS (
      SELECT
        (ot.amount::numeric / 1e18)        AS amount_tokens,
        COALESCE(pf.price_usd::numeric, 0) AS price_usd,
        ot.point_rate                      AS point_rate,
        b.m                                AS boost_m
      FROM open_tasks ot
      CROSS JOIN boost b
      LEFT JOIN LATERAL (
        SELECT pf.price_usd
        FROM points.price_feeds pf
        WHERE pf.address = ot.token_address
          AND pf.timestamp < ${now}::timestamp
        ORDER BY pf.timestamp DESC
        LIMIT 1
      ) pf ON TRUE
    ),
    daily AS (
      SELECT
        COALESCE(
          ROUND(
            SUM(amount_tokens * price_usd * 86400 * point_rate * boost_m)
          ), 0
        )::bigint AS daily_rate
      FROM per_task
    )
    SELECT
      (SELECT base_points FROM base)
      + COALESCE((SELECT referral_points FROM referral), 0)::bigint
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
}
