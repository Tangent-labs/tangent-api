import { FastifyInstance } from "fastify"
import { isAddress } from "viem"
import { RawEvent, UserPointsRow, UserTaskRow } from "../types"
import { AddressLike } from "ethers"
import { rangeToMinDate } from "../utils"
export class EventRepository {
  fastify: FastifyInstance

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify
  }

  async getEventsByAccount(account: string, market: string): Promise<RawEvent[]> {
    try {
      if (!isAddress(account) || !isAddress(market)) {
        throw new Error("Invalid account or market address")
      }

      const marketResult = await this.fastify.pg.query<{ id: string }>(
        `
      SELECT id
      FROM events.usg_markets
      WHERE LOWER(contract_address) = LOWER($1)
      `,
        [market]
      )

      if (marketResult.rows.length === 0) {
        throw new Error(`No market found for contract_address: ${market}`)
      }

      const market_id = marketResult.rows[0].id

      const { rows } = await this.fastify.pg.query<RawEvent>(
        `
      SELECT 'borrow' AS label, '0' AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.borrow
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'deposit' AS label, staked_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
      FROM events.deposit
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'zap_deposit' AS label, staked_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_deposit
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'deposit_and_borrow' AS label, staked_amount AS collat_amount, borrow_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.deposit_and_borrow
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'zap_deposit_and_borrow' AS label, staked_amount AS collat_amount, borrow_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_deposit_and_borrow
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'withdraw' AS label, withdrawn_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
      FROM events.withdraw
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'repay' AS label, '0' AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.repay
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'repay_and_withdraw' AS label, withdrawn_amount AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.repay_and_withdraw
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'zap_repay' AS label, '0' AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_repay
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'zap_repay_and_withdraw' AS label, withdrawn_amount AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_repay_and_withdraw
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'leverage' AS label, staked_amount AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.leverage
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'zap_leverage' AS label, staked_amount AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_leverage
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'liquidate' AS label, collateral_liquidated AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.liquidate
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'self_liquidate' AS label, collateral_liquidated AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.self_liquidate
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      ORDER BY date DESC
      `,
        [account, market_id]
      )

      if (rows.length === 0) {
        this.fastify.log.warn(`No events found for account: ${account}, market: ${market} (market_id: ${market_id})`)
      }

      return rows
    } catch (err: any) {
      this.fastify.log.error("Query error:", {
        message: err.message,
        stack: err.stack,
        code: err.code,
        detail: err.detail,
        hint: err.hint,
      } as any)
      throw new Error(`Database query failed: ${err.message}`)
    }
  }

  /**
   * @param marketAddress marketAddress provided by the frontend
   * @param dateFrom ISO date/time from the frontend (trusted block time)
   * @param range '1w' | '1m' | '1y' | 'all'
   * @param rowAmounts max number of points displayed in the graph
   */
  async getHistoricalData(marketAddress: AddressLike, dateFrom: string, range: string, rowAmounts: number = 100) {
    const minDate = rangeToMinDate(range, dateFrom) // always a string (incl. for "all")

    const chartData = await this.fastify.prisma.$queryRaw<any[]>`
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

  async getUserTasks(userAddress: string): Promise<UserTaskRow[]> {
    const addr = userAddress.toLowerCase()

    const rows = await this.fastify.prisma.$queryRaw<UserTaskRow[]>`
  WITH ut_open AS (
    SELECT task_id, COUNT(*) AS open_count
    FROM points.user_tasks
    WHERE lower(user_address) = ${addr}
      AND closed IS NULL
    GROUP BY task_id
  ),
  up_sum AS (
    SELECT task_id, SUM(points)::int AS points_sum
    FROM points.user_points
    WHERE lower(user_address) = ${addr}
    GROUP BY task_id
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
  FROM points.task t
  LEFT JOIN ut_open  ON ut_open.task_id = t.id
  LEFT JOIN up_sum   ON up_sum.task_id  = t.id
  ORDER BY t.id;
`

    return rows
  }

  async getUserPoints(userAddress: string): Promise<{
    totalPoints: bigint
    basePoints: bigint
    referralPoints: bigint
    dailyRate: bigint
  }> {
    const addr = userAddress.toLowerCase()

    const computedPoints = await this.fastify.prisma.$queryRaw<UserPointsRow[]>`
    WITH base AS (
      SELECT COALESCE(SUM(up.points), 0)::bigint AS base_points
      FROM points.user_points up
      WHERE up.user_address = ${addr}
    )
    SELECT
      b.base_points,
      COALESCE(u.referral_points, 0)::bigint AS referral_points,
      b.base_points + COALESCE(u.referral_points, 0)::bigint AS total_points
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

    const rate = await this.fastify.prisma.$queryRaw<{ daily_rate: bigint }[]>`
    WITH me AS (
      SELECT ${addr}::text AS address
    ),
    boost AS (
      SELECT COALESCE((
        SELECT ub.multiplier::numeric
        FROM points.user_boost ub
        WHERE ub.user_address = (SELECT address FROM me)
          AND ub.start_at <= NOW()
          AND (ub.end_at IS NULL OR ub.end_at > NOW())
        ORDER BY ub.start_at DESC
        LIMIT 1
      ), 1.00::numeric) AS m
    ),
    open_tasks AS (
      SELECT
        ut.amount,
        t.point_rate::numeric   AS point_rate,
        t.unit::text            AS unit,
        t.token_address::text   AS token_address
      FROM points.user_tasks ut
      JOIN points.task t ON t.id = ut.task_id
      WHERE ut.user_address = (SELECT address FROM me)
        AND ut.closed IS NULL
    ),
    per_task AS (
      SELECT
        (ot.amount::numeric / 1e18)        AS amount_tokens,
        COALESCE(pf.price_usd::numeric, 0) AS price_usd,
        CASE
          WHEN ot.unit = 'hour'   THEN 3600::numeric
          WHEN ot.unit = 'day'    THEN 86400::numeric
          ELSE 1::numeric
        END                                AS unit_seconds,
        ot.point_rate                      AS point_rate,
        b.m                                AS boost_m
      FROM open_tasks ot
      CROSS JOIN boost b
      LEFT JOIN LATERAL (
        SELECT pf.price_usd
        FROM points.price_feeds pf
        WHERE LOWER(pf.token) = LOWER(ot.token_address)
          AND pf.timestamp <= NOW()
        ORDER BY pf.timestamp DESC
        LIMIT 1
      ) pf ON TRUE
    )
    SELECT
      COALESCE(
        ROUND(
          SUM(
            amount_tokens
            * price_usd
            * (86400::numeric / NULLIF(unit_seconds, 0))
            * point_rate
            * boost_m
          )
        ), 0
      )::bigint AS daily_rate
    FROM per_task;
  `

    const dailyRate = rate[0]?.daily_rate ?? 0n

    return {
      basePoints: totals.base_points,
      referralPoints: totals.referral_points,
      totalPoints: totals.total_points,
      dailyRate,
    }
  }
}
