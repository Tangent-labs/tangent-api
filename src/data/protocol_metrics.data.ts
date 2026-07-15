import { Prisma, PrismaClient } from "@prisma/client"
import { MarketAPR, PositionsQuery, RawEvent, SavingAccountsApy } from "../types.js"
import { AddressLike, isAddress } from "ethers"
import { rangeToMinDate } from "../utils.js"

export type TokenPoint = { timestamp: Date; amount: string }
export type OraclePricePoint = {
  ts: number
  price: number | null
}

export type TokenPricePoint = {
  tokenAddress: string
  priceUSD: string | null
}

export type TokenPriceHistoryPoint = {
  tokenAddress: string
  timestamp: Date
  amount: string
}

export type PriceSourceItem = {
  tokenAddress: string
  name: string
}

export type ActiveBorrowPosition = {
  contractName: string
  contractAddress: string
  borrowerAddress: string
  debtShares: string
}

export class ProtocolMetricsRepository {
  prismaClient: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prismaClient = prisma
  }

  async getPositions(market: string, query: PositionsQuery): Promise<{ rows: RawEvent[]; total: number }> {
    if (!isAddress(market)) {
      throw new Error("Invalid market address")
    }
    if (query.userAddress !== undefined && !isAddress(query.userAddress)) {
      throw new Error("Invalid user address")
    }

    const marketResult = await this.prismaClient.$queryRaw<{ id: string }[]>`
        SELECT id FROM global.usg_markets WHERE LOWER(contract_address) = LOWER(${market})
      `
    if (marketResult.length === 0) throw new Error(`No market found for contract_address: ${market}`)

    const market_id = marketResult[0].id

    // userAddress is optional
    const accountFilter = query.userAddress !== undefined ? Prisma.sql`AND account = ${query.userAddress}` : Prisma.sql``

    // The UNION over all event tables.
    const allEvents = Prisma.sql`
        SELECT 'borrow' AS label, '0' AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
        FROM events.borrow WHERE market_id = ${market_id} ${accountFilter}
        UNION ALL
        SELECT 'deposit' AS label, staked_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
        FROM events.deposit WHERE market_id = ${market_id} ${accountFilter}
        UNION ALL
        SELECT 'zap_deposit' AS label, staked_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
        FROM events.zap_deposit WHERE market_id = ${market_id} ${accountFilter}
        UNION ALL
        SELECT 'deposit_and_borrow' AS label, staked_amount AS collat_amount, borrow_amount AS usg_amount, block_date::text AS date, tx_hash
        FROM events.deposit_and_borrow WHERE market_id = ${market_id} ${accountFilter}
        UNION ALL
        SELECT 'zap_deposit_and_borrow' AS label, staked_amount AS collat_amount, borrow_amount AS usg_amount, block_date::text AS date, tx_hash
        FROM events.zap_deposit_and_borrow WHERE market_id = ${market_id} ${accountFilter}
        UNION ALL
        SELECT 'withdraw' AS label, withdrawn_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
        FROM events.withdraw WHERE market_id = ${market_id} ${accountFilter}
        UNION ALL
        SELECT 'repay' AS label, '0' AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
        FROM events.repay WHERE market_id = ${market_id} ${accountFilter}
        UNION ALL
        SELECT 'repay_and_withdraw' AS label, withdrawn_amount AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
        FROM events.repay_and_withdraw WHERE market_id = ${market_id} ${accountFilter}
        UNION ALL
        SELECT 'zap_repay' AS label, '0' AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
        FROM events.zap_repay WHERE market_id = ${market_id} ${accountFilter}
        UNION ALL
        SELECT 'zap_repay_and_withdraw' AS label, withdrawn_amount AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
        FROM events.zap_repay_and_withdraw WHERE market_id = ${market_id} ${accountFilter}
        UNION ALL
        SELECT 'leverage' AS label, staked_amount AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
        FROM events.leverage WHERE market_id = ${market_id} ${accountFilter}
        UNION ALL
        SELECT 'zap_leverage' AS label, staked_amount AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
        FROM events.zap_leverage WHERE market_id = ${market_id} ${accountFilter}
        UNION ALL
        SELECT 'liquidate' AS label, collateral_liquidated AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
        FROM events.liquidate WHERE market_id = ${market_id} ${accountFilter}
        UNION ALL
        SELECT 'self_liquidate' AS label, collateral_liquidated AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
        FROM events.self_liquidate WHERE market_id = ${market_id} ${accountFilter}
      `

    // Retrieve a page of events and the total number of matching events
    const rows = await this.prismaClient.$queryRaw<(RawEvent & { total: bigint })[]>`
        SELECT label, collat_amount, usg_amount, date, tx_hash,
               COUNT(*) OVER() AS total
        FROM (${allEvents}) AS all_events
        ORDER BY date::timestamptz DESC, tx_hash ASC
        LIMIT ${query.pageSize} OFFSET ${query.offset}
      `

    const total = rows.length > 0 ? Number(rows[0].total) : 0

    return { rows, total }
  }

  /**
   * @param marketAddress marketAddress provided by the frontend
   * @param dateFrom ISO date/time from the frontend (trusted block time)
   * @param range '1w' | '1m' | '1y' | 'all'
   * @param rowAmounts max number of points displayed in the graph
   */
  async getHistoricalData(marketAddress: AddressLike, dateFrom: string, range: string, rowAmounts: number = 100) {
    const minDate = rangeToMinDate(range, dateFrom) // always a string (incl. for "all")

    const chartData = await this.prismaClient.$queryRaw<
      { timestamp: Date; tvl_usd: Prisma.Decimal; total_debt: Prisma.Decimal; ir_apy: Prisma.Decimal; apr_current: Prisma.Decimal }[]
    >`
    WITH filtered_data AS (
      SELECT mgd.id, mgd.timestamp, mgd.tvl_usd, mgd.total_debt, mgd.ir_apy, um.contract_address, mgd.apr_current
      FROM global.market_global_data AS mgd
      JOIN global.usg_markets AS um ON mgd.market_id = um.id
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

  async getOraclePriceBuckets(marketAddress: AddressLike, startISO: string, endISO: string, bucketCount: number): Promise<OraclePricePoint[]> {
    return await this.prismaClient.$queryRaw<OraclePricePoint[]>`
      WITH params AS (
        SELECT
          ${String(marketAddress).toLowerCase()} AS market_address,
          ${startISO}::timestamptz AS start_ts,
          ${endISO}::timestamptz AS end_ts,
          ${bucketCount}::int AS bucket_count
      ),
      bounds AS (
        SELECT
          market_address,
          start_ts,
          end_ts,
          bucket_count,
          start_ts AT TIME ZONE 'UTC' AS start_ts_utc,
          end_ts AT TIME ZONE 'UTC' AS end_ts_utc,
          ((end_ts - start_ts) / bucket_count) AS bucket_width
        FROM params
      ),
      buckets AS (
        SELECT
          gs AS bucket_idx,
          b.start_ts + (gs * b.bucket_width) AS bucket_start,
          CASE
            WHEN gs = b.bucket_count - 1 THEN b.end_ts
            ELSE b.start_ts + ((gs + 1) * b.bucket_width)
          END AS bucket_end
        FROM bounds b
        CROSS JOIN generate_series(0, (SELECT bucket_count - 1 FROM bounds)) gs
      ),
      filtered AS (
        SELECT
          mgd.id,
          (mgd.timestamp AT TIME ZONE 'UTC') AS ts,
          mgd.oracle_price::numeric AS price
        FROM global.market_global_data mgd
        JOIN global.usg_markets um
          ON um.id = mgd.market_id
        JOIN bounds b
          ON TRUE
        WHERE um.contract_address = b.market_address
          AND mgd.timestamp >= b.start_ts_utc
          AND mgd.timestamp <= b.end_ts_utc
          AND mgd.oracle_price IS NOT NULL
      ),
      bucketed AS (
        SELECT
          b.bucket_idx,
          b.bucket_start,
          b.bucket_end,
          f.id,
          f.ts,
          f.price
        FROM buckets b
        LEFT JOIN filtered f
          ON f.ts >= b.bucket_start
        AND (
          f.ts < b.bucket_end
          OR (f.ts = b.bucket_end AND b.bucket_idx = (SELECT bucket_count - 1 FROM bounds))
        )
      ),
      ranked AS (
        SELECT
          bucket_idx,
          bucket_start,
          price,
          ROW_NUMBER() OVER (PARTITION BY bucket_idx ORDER BY ts DESC, id DESC) AS rn
        FROM bucketed
        WHERE ts IS NOT NULL
      )
      SELECT
        FLOOR(EXTRACT(EPOCH FROM b.bucket_start) * 1000)::float8 AS ts,
        MAX(CASE WHEN r.rn = 1 THEN r.price END)::float8 AS price
      FROM buckets b
      LEFT JOIN ranked r
        ON r.bucket_idx = b.bucket_idx
      GROUP BY b.bucket_idx, b.bucket_start
      ORDER BY b.bucket_idx ASC;
    `
  }

  async getTotalValueLocked(
    fromISO: string | null,
    toISO: string,
    targetPoints: number
  ): Promise<{ date: Date; total: string; markets: string; wts: string; pegkeepers: string; susg: string }[]> {
    const rows = await this.prismaClient.$queryRaw<{ date: Date; total: string; markets: string; wts: string; pegkeepers: string; susg: string }[]>`
    WITH data AS (
      SELECT
        ugh."date"                     AS date,
        ugh."total_tvl"::numeric       AS total_tvl,
        ugh."tvl_markets"::numeric     AS tvl_markets,
        ugh."tvl_wstables"::numeric    AS tvl_wstables,
        ugh."tvl_peg_keepers"::numeric AS tvl_peg_keepers,
        ugh."tvl_susg"::numeric        AS tvl_susg
      FROM "global"."usg_global_history" ugh
      WHERE ugh."date" >= COALESCE(
        ${fromISO}::timestamptz,
        (SELECT MIN("date") FROM "global"."usg_global_history")
      )
      AND ugh."date" <= ${toISO}::timestamptz
    ),
    counts AS (
      SELECT
        GREATEST(1, CEIL(COUNT(*)::numeric / ${targetPoints}::numeric)) AS step
      FROM data
    ),
    ranked AS (
      SELECT
        d.*,
        ROW_NUMBER() OVER (ORDER BY d.date ASC) AS rn,
        COUNT(*)    OVER ()                          AS total_rows,
        c.step
      FROM data d
      CROSS JOIN counts c
    )
    SELECT
      date,
      total_tvl       AS total,
      tvl_markets     AS markets,
      tvl_wstables    AS wts,
      tvl_peg_keepers AS "pegkeepers",
      tvl_susg        AS susg
    FROM ranked
    WHERE (rn - 1) % step = 0
       OR rn = total_rows 
    ORDER BY date ASC;
  `

    return rows
  }

  async getTotalSupply(address: string, fromISO: string | null, toISO: string, targetPoints: number): Promise<{ timestamp: Date; amount: string }[]> {
    const rows = await this.prismaClient.$queryRaw<{ timestamp: Date; amount: string }[]>`
    WITH token AS (
      SELECT te."id" AS token_id
      FROM "points"."tracked_erc20" te
      WHERE te."address" = ${address.toLowerCase()}
      LIMIT 1
    ),
    filtered AS (
      SELECT
        ts."timestamp" AS timestamp,
        (ts."total_supply")::numeric / ${BigInt(10 ** 18)}::numeric AS amount
      FROM "global"."total_supplies" ts
      JOIN token ON token.token_id = ts."token_id"
      WHERE ts."timestamp" >= COALESCE(
              ${fromISO}::timestamptz,
              (SELECT MIN(ts2."timestamp") FROM "global"."total_supplies" ts2 JOIN token t2 ON t2.token_id = ts2."token_id")
            )
        AND ts."timestamp" <= ${toISO}::timestamptz
    ),
    row_ratio AS (
      SELECT GREATEST(CEIL(COUNT(*)::numeric / ${targetPoints}::numeric), 1)::int AS ratio
      FROM filtered
    ),
    ranked AS (
      SELECT
        f.timestamp,
        f.amount,
        ROW_NUMBER() OVER (ORDER BY f.timestamp DESC) AS rn
      FROM filtered f
    )
    SELECT
      r.timestamp,
      (r.amount)::text AS amount
    FROM ranked r, row_ratio rr
    WHERE (r.rn - 1) % rr.ratio = 0
    ORDER BY r.timestamp ASC;
  `

    return rows
  }

  async getLatestPrices(tokenAddresses: string[]): Promise<TokenPricePoint[]> {
    const normalizedAddresses = tokenAddresses.map((address) => address.toLowerCase())
    const inputRows = normalizedAddresses.map((address, index) => Prisma.sql`(${address}, ${index})`)

    if (inputRows.length === 0) {
      return []
    }

    return await this.prismaClient.$queryRaw<TokenPricePoint[]>`
      WITH input(address, ord) AS (
        VALUES ${Prisma.join(inputRows)}
      )
      SELECT
        i.address AS "tokenAddress",
        lpf.price_usd::text AS "priceUSD"
      FROM input i
      LEFT JOIN points.price_source ps
        ON ps.address = i.address
      LEFT JOIN points.last_price_feeds lpf
        ON lpf.price_source_id = ps.id
      ORDER BY i.ord ASC;
    `
  }

  async getPriceHistory(addresses: string[], fromISO: string | null, toISO: string, targetPoints: number): Promise<TokenPriceHistoryPoint[]> {
    const normalizedAddresses = addresses.map((address) => address.toLowerCase())
    const inputRows = normalizedAddresses.map((address, index) => Prisma.sql`(${address}, ${index})`)

    if (inputRows.length === 0) {
      return []
    }

    return await this.prismaClient.$queryRaw<TokenPriceHistoryPoint[]>`
      WITH input(address, ord) AS (
        VALUES ${Prisma.join(inputRows)}
      ),
      token_price_source AS (
        SELECT
          ps.address AS token_address,
          ps.id AS price_source_id
        FROM points.price_source ps
        JOIN input i ON i.address = ps.address
      ),
      filtered AS (
        SELECT
          tps.token_address AS "tokenAddress",
          i.ord,
          pf.timestamp,
          pf.price_usd::text AS amount
        FROM points.price_feeds pf
        JOIN token_price_source tps ON tps.price_source_id = pf.price_source_id
        JOIN input i ON i.address = tps.token_address
        WHERE pf.timestamp >= COALESCE(
                ${fromISO}::timestamptz,
                (
                  SELECT MIN(pf2.timestamp)
                  FROM points.price_feeds pf2
                  JOIN token_price_source tps2 ON tps2.price_source_id = pf2.price_source_id
                  WHERE tps2.token_address = tps.token_address
                )
              )
          AND pf.timestamp <= ${toISO}::timestamptz
      ),
      row_ratio AS (
        SELECT
          "tokenAddress",
          GREATEST(CEIL(COUNT(*)::numeric / ${targetPoints}::numeric), 1)::int AS ratio
        FROM filtered
        GROUP BY "tokenAddress"
      ),
      ranked AS (
        SELECT
          f."tokenAddress",
          f.ord,
          f.timestamp,
          f.amount,
          ROW_NUMBER() OVER (PARTITION BY f."tokenAddress" ORDER BY f.timestamp ASC) AS rn
        FROM filtered f
      )
      SELECT
        r."tokenAddress",
        r.timestamp,
        r.amount
      FROM ranked r
      JOIN row_ratio rr ON rr."tokenAddress" = r."tokenAddress"
      WHERE (r.rn - 1) % rr.ratio = 0
      ORDER BY r.ord ASC, r.timestamp ASC;
    `
  }

  async getLastMarketAprs(): Promise<MarketAPR[]> {
    const rows = await this.prismaClient.$queryRaw<
      Array<{
        contract_name: string
        contract_address: string
        apr_current: Prisma.JsonValue
        apr_projected: Prisma.JsonValue
      }>
    >`
      SELECT
        m."contract_name",
        m."contract_address",
        l."timestamp",
        l."apr_current",
        l."apr_projected"
      FROM "global"."usg_markets" m
      JOIN "global"."latest_global_data" l ON l."market_id" = m."id"
     `

    return rows.map((r) => ({
      currentAPR: (r.apr_current ?? {}) as unknown as Record<string, number>,
      projectedAPR: (r.apr_projected ?? {}) as unknown as Record<string, number>,
      marketAddress: r.contract_address.toLowerCase(),
      marketName: r.contract_name,
    }))
  }

  async getSavingAccountsApy(): Promise<SavingAccountsApy[]> {
    if (!this.prismaClient) {
      throw new Error("Prisma client is not initialized")
    }

    try {
      const data = await this.prismaClient.$queryRaw<
        Array<{
          timestamp: Date
          value: number
          key: string
          tokenAddress: string
        }>
      >`
         SELECT
          giv.timestamp,
          giv.value,
          gi.key,
          gi.args as "tokenAddress"
        FROM global.global_indicators_values giv
        JOIN global.global_indicators gi ON gi.id = giv.global_indicator_id
        WHERE gi.key IN ('SAVING_APY_USG', 'SAVING_APY_TAN')
          AND giv.timestamp = (
            SELECT MAX(giv2.timestamp)
            FROM global.global_indicators_values giv2
            WHERE giv2.global_indicator_id = giv.global_indicator_id
          )
        ORDER BY gi.key
      `

      return data
    } catch (error) {
      console.error("Database error in getSavingAccountsApy:", error)
      throw error
    }
  }

  async getActiveBorrowPositions(): Promise<ActiveBorrowPosition[]> {
    return await this.prismaClient.$queryRaw<ActiveBorrowPosition[]>`
      SELECT
        um.contract_name    AS "contractName",
        um.contract_address AS "contractAddress",
        ab.borrower_address AS "borrowerAddress",
        ab.debt_shares::text AS "debtShares"
      FROM global.active_borrowers ab
      INNER JOIN global.usg_markets um ON um.id = ab.market_id
      ORDER BY ab.debt_shares DESC
    `
  }

  async getSUSGApy(key: string, fromISO: string | null, toISO: string, targetPoints: number = 300): Promise<{ timestamp: Date; amount: number }[]> {
    return await this.prismaClient.$queryRaw<{ timestamp: Date; amount: number }[]>`
    WITH indicator AS (
      SELECT id
      FROM global.global_indicators
      WHERE key = ${key}
      LIMIT 1
    ),
    filtered AS (
      SELECT
        giv.timestamp,
        giv.value AS amount
      FROM global.global_indicators_values giv
      JOIN indicator i ON giv.global_indicator_id = i.id
      WHERE giv.timestamp >= COALESCE(
              ${fromISO}::timestamptz,
              (SELECT MIN(timestamp) FROM global.global_indicators_values WHERE global_indicator_id = i.id)
            )
        AND giv.timestamp <= ${toISO}::timestamptz
      ORDER BY giv.timestamp ASC
    ),
    row_ratio AS (
      SELECT GREATEST(CEIL(COUNT(*)::numeric / ${targetPoints}::numeric), 1)::int AS ratio
      FROM filtered
    ),
    ranked AS (
      SELECT
        f.timestamp,
        f.amount,
        ROW_NUMBER() OVER (ORDER BY f.timestamp ASC) AS rn
      FROM filtered f
    )
    SELECT
      r.timestamp,
      r.amount
    FROM ranked r
    CROSS JOIN row_ratio rr
    WHERE (r.rn - 1) % rr.ratio = 0
    ORDER BY r.timestamp ASC;
  `
  }
}
