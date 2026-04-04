import { PrismaClient, Prisma } from "@prisma/client"
import { ModuleFilters } from "../services/monitoring/monitoring.types.js"

interface OverviewRow {
  active_positions: bigint
  at_risk_positions: bigint
}

interface CollateralizationRow {
  borrower_address: string
  market_name: string
  collateral_value: number
  debt: number
  liquidation_threshold: number
  cr: number
  margin: number
  health_ratio: number
  status: string
  total: bigint
}

interface LiquidationDistanceRow {
  borrower_address: string
  market_name: string
  collateral_value: number
  debt: number
  liquidation_price: number
  current_price: number
  distance_pct: number
  status: string
  total: bigint
}

interface PegRow {
  symbol: string
  peg_type: string
  price: number
  ref_price: number
  deviation_pct: number
  timestamp: Date
}

interface OracleSanityRow {
  market_address: string
  market_name: string
  oracle_price: number
  offchain_price: number
  deviation_pct: number
  timestamp: Date
}

interface DebtUtilizationRow {
  market_address: string
  market_name: string
  total_debt: number
  max_debt: number
  utilization_pct: number
}

interface TvlVariationRow {
  market_address: string
  market_name: string
  tvl_current: number
  delta_1h_pct: number
  delta_24h_pct: number
}

interface PriceVariationRow {
  market_address: string
  asset: string
  is_stable: boolean
  delta_5m: number
  delta_15m: number
  delta_1h: number
  delta_4h: number
}

interface LiquidationRow {
  date: Date
  borrower: string
  market: string
  type: string
  collateral_liquidated: string | null
  profit: string | null
  success: boolean
  tx_hash: string | null
}

interface LiquidationSummaryRow {
  success_count: bigint
  failure_count: bigint
  total_profit: number | null
  total_bad_debt: number | null
  total: bigint
}

interface LtvDistributionRow {
  market_name: string
  max_ltv: number
  bucket: string
  count: bigint
  tvl: number
  bad_debt: number
}

export interface BlockRow {
  block_id: bigint
  created_at: Date | null
}

export class MonitoringRepository {
  prismaClient: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prismaClient = prisma
  }

  async getOverviewPositions(warningMultiplier: number): Promise<OverviewRow> {
    const rows = await this.prismaClient.$queryRaw<OverviewRow[]>`
      WITH latest_positions AS (
        SELECT ps.*, ROW_NUMBER() OVER (
          PARTITION BY ps.market_id, ps.borrower_address
          ORDER BY ps.snapshot_timestamp DESC
        ) AS rn
        FROM global.position_snapshots ps
        WHERE ps.user_debt > 0
      ),
      active AS (
        SELECT * FROM latest_positions WHERE rn = 1
      )
      SELECT
        COUNT(*)::bigint AS active_positions,
        COUNT(*) FILTER (
          WHERE a.cr < mc.liquidation_threshold * ${warningMultiplier}
        )::bigint AS at_risk_positions
      FROM active a
      JOIN global.market_config mc ON mc.market_id = a.market_id
    `
    return rows[0] || { active_positions: BigInt(0), at_risk_positions: BigInt(0) }
  }

  async getMaxBlock(): Promise<BlockRow | null> {
    const rows = await this.prismaClient.$queryRaw<BlockRow[]>`
      SELECT block_id, created_at
      FROM events.event_blocks
      ORDER BY block_id DESC
      LIMIT 1
    `
    return rows[0] || null
  }

  async getCollateralizationRows(
    filters: ModuleFilters,
    warningMult: number,
    dangerMult: number,
    criticalMult: number
  ): Promise<{ rows: CollateralizationRow[]; total: number }> {
    const sortCol = filters.sort_by === "cr" ? Prisma.sql`ws.cr` : Prisma.sql`ws.margin`
    const marketFilter = filters.market_address
      ? Prisma.sql`AND ps.market_id = (SELECT id FROM global.usg_markets WHERE LOWER(contract_address) = LOWER(${filters.market_address}))`
      : Prisma.sql``
    const borrowerFilter = filters.borrower_address ? Prisma.sql`AND ps.borrower_address = ${filters.borrower_address}` : Prisma.sql``
    const statusFilter = filters.status
      ? Prisma.sql`AND CASE
            WHEN lp.cr >= mc.liquidation_threshold * ${warningMult} THEN 'safe'
            WHEN lp.cr >= mc.liquidation_threshold * ${dangerMult} THEN 'warning'
            WHEN lp.cr >= mc.liquidation_threshold * ${criticalMult} THEN 'danger'
            ELSE 'critical'
          END = ${filters.status}`
      : Prisma.sql``

    const rows = await this.prismaClient.$queryRaw<CollateralizationRow[]>`
      WITH latest_positions AS (
        SELECT ps.*, ROW_NUMBER() OVER (
          PARTITION BY ps.market_id, ps.borrower_address
          ORDER BY ps.snapshot_timestamp DESC
        ) AS rn
        FROM global.position_snapshots ps
        WHERE ps.user_debt > 0
        ${marketFilter}
        ${borrowerFilter}
      ),
      with_status AS (
        SELECT
          lp.borrower_address,
          um.contract_name AS market_name,
          lp.position_value_usd AS collateral_value,
          lp.user_debt AS debt,
          mc.liquidation_threshold,
          lp.cr,
          lp.margin,
          lp.health_ratio,
          CASE
            WHEN lp.cr >= mc.liquidation_threshold * ${warningMult} THEN 'safe'
            WHEN lp.cr >= mc.liquidation_threshold * ${dangerMult} THEN 'warning'
            WHEN lp.cr >= mc.liquidation_threshold * ${criticalMult} THEN 'danger'
            ELSE 'critical'
          END AS status,
          COUNT(*) OVER () AS total
        FROM latest_positions lp
        JOIN global.market_config mc ON mc.market_id = lp.market_id
        JOIN global.usg_markets um ON um.id = lp.market_id
        WHERE lp.rn = 1
        ${statusFilter}
      )
      SELECT * FROM with_status ws
      ORDER BY ${sortCol} ASC
      LIMIT ${filters.limit} OFFSET ${filters.offset}
    `

    const total = rows.length > 0 ? Number(rows[0].total) : 0
    return { rows, total }
  }

  async getLiquidationDistanceRows(
    filters: ModuleFilters,
    safePct: number,
    warningPct: number,
    dangerPct: number
  ): Promise<{ rows: LiquidationDistanceRow[]; total: number }> {
    const marketFilter = filters.market_address
      ? Prisma.sql`AND ps.market_id = (SELECT id FROM global.usg_markets WHERE LOWER(contract_address) = LOWER(${filters.market_address}))`
      : Prisma.sql``
    const borrowerFilter = filters.borrower_address ? Prisma.sql`AND ps.borrower_address = ${filters.borrower_address}` : Prisma.sql``
    const statusFilter = filters.status
      ? Prisma.sql`AND CASE
            WHEN lp.distance_pct >= ${safePct} THEN 'safe'
            WHEN lp.distance_pct >= ${warningPct} THEN 'warning'
            WHEN lp.distance_pct >= ${dangerPct} THEN 'danger'
            ELSE 'critical'
          END = ${filters.status}`
      : Prisma.sql``

    const rows = await this.prismaClient.$queryRaw<LiquidationDistanceRow[]>`
      WITH latest_positions AS (
        SELECT ps.*, ROW_NUMBER() OVER (
          PARTITION BY ps.market_id, ps.borrower_address
          ORDER BY ps.snapshot_timestamp DESC
        ) AS rn
        FROM global.position_snapshots ps
        WHERE ps.user_debt > 0
        ${marketFilter}
        ${borrowerFilter}
      ),
      with_status AS (
        SELECT
          lp.borrower_address,
          um.contract_name AS market_name,
          lp.position_value_usd AS collateral_value,
          lp.user_debt AS debt,
          lp.liquidation_price,
          lgd.oracle_price AS current_price,
          lp.distance_pct,
          CASE
            WHEN lp.distance_pct >= ${safePct} THEN 'safe'
            WHEN lp.distance_pct >= ${warningPct} THEN 'warning'
            WHEN lp.distance_pct >= ${dangerPct} THEN 'danger'
            ELSE 'critical'
          END AS status,
          COUNT(*) OVER () AS total
        FROM latest_positions lp
        JOIN global.latest_global_data lgd ON lgd.market_id = lp.market_id
        JOIN global.usg_markets um ON um.id = lp.market_id
        WHERE lp.rn = 1
        ${statusFilter}
      )
      SELECT * FROM with_status ws
      ORDER BY ws.distance_pct ASC
      LIMIT ${filters.limit} OFFSET ${filters.offset}
    `

    const total = rows.length > 0 ? Number(rows[0].total) : 0
    return { rows, total }
  }

  async getPegRows(): Promise<PegRow[]> {
    return await this.prismaClient.$queryRaw<PegRow[]>`
      WITH ts_now AS (
        SELECT MAX(timestamp) AS ts_now
        FROM global.peg_sanity_snapshots
      )
      SELECT
        pmt.symbol,
        pmt.peg_type,
        pss.price,
        pss.ref_price,
        pss.deviation_pct,
        pss.timestamp
      FROM global.peg_monitored_tokens pmt
      JOIN global.peg_sanity_snapshots pss ON pss.token_id = pmt.id
      CROSS JOIN ts_now t
      WHERE pmt.active = true
        AND pss.timestamp = t.ts_now
    `
  }

  async getOracleSanityRows(): Promise<OracleSanityRow[]> {
    return await this.prismaClient.$queryRaw<OracleSanityRow[]>`
      WITH ts_now AS (
        SELECT MAX(timestamp) AS ts_now
        FROM global.oracle_sanity_snapshots
      )
      SELECT
        um.contract_address AS market_address,
        um.contract_name AS market_name,
        oss.oracle_price,
        oss.offchain_price,
        oss.deviation_pct,
        oss.timestamp
      FROM global.oracle_sanity_snapshots oss
      JOIN global.usg_markets um ON um.id = oss.market_id
      CROSS JOIN ts_now t
      WHERE um.is_active = true
        AND oss.timestamp = t.ts_now
    `
  }

  async getDebtUtilizationRows(): Promise<DebtUtilizationRow[]> {
    return await this.prismaClient.$queryRaw<DebtUtilizationRow[]>`
      SELECT
        um.contract_address AS market_address,
        um.contract_name AS market_name,
        lgd.total_debt,
        mc.max_debt,
        CASE WHEN mc.max_debt > 0
          THEN (lgd.total_debt / mc.max_debt * 100)
          ELSE 0
        END AS utilization_pct
      FROM global.latest_global_data lgd
      JOIN global.market_config mc ON mc.market_id = lgd.market_id
      JOIN global.usg_markets um ON um.id = lgd.market_id
      WHERE um.is_active = true
    `
  }

  async getTvlVariationRows(): Promise<TvlVariationRow[]> {
    return await this.prismaClient.$queryRaw<TvlVariationRow[]>`
      WITH ts_now AS (
        SELECT MAX(timestamp) AS t
        FROM global.market_global_data
      ),
      nearest_ts AS (
        SELECT
          t AS ts_now,
          (SELECT MAX(timestamp) FROM global.market_global_data WHERE timestamp <= t - INTERVAL '1 hour') AS ts_1h,
          (SELECT MAX(timestamp) FROM global.market_global_data WHERE timestamp <= t - INTERVAL '24 hours') AS ts_24h
        FROM ts_now
      ),
      snapshots_filtered AS (
        SELECT market_id, tvl_usd, timestamp
        FROM global.market_global_data
        WHERE timestamp IN (
          SELECT ts_now FROM nearest_ts
          UNION
          SELECT ts_1h FROM nearest_ts
          UNION
          SELECT ts_24h FROM nearest_ts
        )
      )
      SELECT
        um.contract_address AS market_address,
        um.contract_name AS market_name,
        s_now.tvl_usd AS tvl_current,
        COALESCE((s_now.tvl_usd - s1.tvl_usd) / NULLIF(s1.tvl_usd, 0) * 100, 0) AS delta_1h_pct,
        COALESCE((s_now.tvl_usd - s24.tvl_usd) / NULLIF(s24.tvl_usd, 0) * 100, 0) AS delta_24h_pct
      FROM global.usg_markets um
      CROSS JOIN nearest_ts nts
      JOIN snapshots_filtered s_now ON s_now.market_id = um.id AND s_now.timestamp = nts.ts_now
      LEFT JOIN snapshots_filtered s1 ON s1.market_id = um.id AND s1.timestamp = nts.ts_1h
      LEFT JOIN snapshots_filtered s24 ON s24.market_id = um.id AND s24.timestamp = nts.ts_24h
      WHERE um.is_active = true
    `
  }

  async getPriceVariationRows(): Promise<PriceVariationRow[]> {
    return await this.prismaClient.$queryRaw<PriceVariationRow[]>`
      WITH ts_now AS (
        SELECT MAX(timestamp) AS t
        FROM global.oracle_sanity_snapshots
      ),
      nearest_ts AS (
        SELECT
          t AS ts_now,
          (SELECT MAX(timestamp) FROM global.oracle_sanity_snapshots WHERE timestamp <= t - INTERVAL '5 minutes') AS ts_5m,
          (SELECT MAX(timestamp) FROM global.oracle_sanity_snapshots WHERE timestamp <= t - INTERVAL '15 minutes') AS ts_15m,
          (SELECT MAX(timestamp) FROM global.oracle_sanity_snapshots WHERE timestamp <= t - INTERVAL '1 hour') AS ts_1h,
          (SELECT MAX(timestamp) FROM global.oracle_sanity_snapshots WHERE timestamp <= t - INTERVAL '4 hours') AS ts_4h
        FROM ts_now
      ),
      snapshots_filtered AS (
        SELECT market_id, oracle_price, timestamp
        FROM global.oracle_sanity_snapshots
        WHERE timestamp IN (
          SELECT ts_now FROM nearest_ts
          UNION
          SELECT ts_5m FROM nearest_ts
          UNION
          SELECT ts_15m FROM nearest_ts
          UNION
          SELECT ts_1h FROM nearest_ts
          UNION
          SELECT ts_4h FROM nearest_ts
        )
      ),
      stable_tokens AS (
        SELECT DISTINCT symbol FROM global.peg_monitored_tokens WHERE peg_type = 'USD' AND active = true
      )
      SELECT
        um.contract_address AS market_address,
        um.contract_name AS asset,
        (EXISTS (SELECT 1 FROM stable_tokens st WHERE um.contract_name ILIKE '%' || st.symbol || '%')) AS is_stable,
        COALESCE((s_now.oracle_price - s5.oracle_price) / NULLIF(s5.oracle_price, 0) * 100, 0) AS delta_5m,
        COALESCE((s_now.oracle_price - s15.oracle_price) / NULLIF(s15.oracle_price, 0) * 100, 0) AS delta_15m,
        COALESCE((s_now.oracle_price - s1h.oracle_price) / NULLIF(s1h.oracle_price, 0) * 100, 0) AS delta_1h,
        COALESCE((s_now.oracle_price - s4h.oracle_price) / NULLIF(s4h.oracle_price, 0) * 100, 0) AS delta_4h
      FROM global.usg_markets um
      CROSS JOIN nearest_ts nts
      JOIN snapshots_filtered s_now ON s_now.market_id = um.id AND s_now.timestamp = nts.ts_now
      LEFT JOIN snapshots_filtered s5 ON s5.market_id = um.id AND s5.timestamp = nts.ts_5m
      LEFT JOIN snapshots_filtered s15 ON s15.market_id = um.id AND s15.timestamp = nts.ts_15m
      LEFT JOIN snapshots_filtered s1h ON s1h.market_id = um.id AND s1h.timestamp = nts.ts_1h
      LEFT JOIN snapshots_filtered s4h ON s4h.market_id = um.id AND s4h.timestamp = nts.ts_4h
      WHERE um.is_active = true
    `
  }

  async getLiquidationRows(filters: ModuleFilters, periodInterval: string): Promise<{ rows: LiquidationRow[]; summary: LiquidationSummaryRow; total: number }> {
    const marketFilter = filters.market_address
      ? Prisma.sql`AND le.market = (SELECT contract_name FROM global.usg_markets WHERE LOWER(contract_address) = LOWER(${filters.market_address}))`
      : Prisma.sql``
    const borrowerFilter = filters.borrower_address ? Prisma.sql`AND le.borrower = ${filters.borrower_address}` : Prisma.sql``

    const summaryRows = await this.prismaClient.$queryRaw<LiquidationSummaryRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE le.success = true)::bigint AS success_count,
        COUNT(*) FILTER (WHERE le.success = false)::bigint AS failure_count,
        COALESCE(SUM(CASE WHEN le.success = true AND le.profit IS NOT NULL
          THEN CAST(REGEXP_REPLACE(le.profit, '[^0-9.\-]', '', 'g') AS numeric) ELSE 0 END), 0) AS total_profit,
        COALESCE((SELECT SUM(lgd.bad_debt) FROM global.latest_global_data lgd), 0) AS total_bad_debt,
        COUNT(*)::bigint AS total
      FROM global.liquidation_execution le
      WHERE le.date >= NOW() - ${periodInterval}::interval
      ${marketFilter}
      ${borrowerFilter}
    `

    const rows = await this.prismaClient.$queryRaw<LiquidationRow[]>`
      SELECT
        le.date,
        le.borrower,
        le.market,
        le.type,
        le.collateral_liquidated,
        le.profit,
        le.success,
        le.tx_hash
      FROM global.liquidation_execution le
      WHERE le.date >= NOW() - ${periodInterval}::interval
      ${marketFilter}
      ${borrowerFilter}
      ORDER BY le.date DESC
      LIMIT ${filters.limit} OFFSET ${filters.offset}
    `

    const summary = summaryRows[0] || {
      success_count: BigInt(0),
      failure_count: BigInt(0),
      total_profit: 0,
      total_bad_debt: 0,
      total: BigInt(0),
    }

    return { rows, summary, total: Number(summary.total) }
  }

  async getLtvDistributionRows(marketAddress?: string): Promise<LtvDistributionRow[]> {
    const marketFilter = marketAddress
      ? Prisma.sql`AND ps.market_id = (SELECT id FROM global.usg_markets WHERE LOWER(contract_address) = LOWER(${marketAddress}))`
      : Prisma.sql``

    return await this.prismaClient.$queryRaw<LtvDistributionRow[]>`
      WITH latest_positions AS (
        SELECT ps.*, ROW_NUMBER() OVER (
          PARTITION BY ps.market_id, ps.borrower_address
          ORDER BY ps.snapshot_timestamp DESC
        ) AS rn
        FROM global.position_snapshots ps
        WHERE ps.user_debt > 0
        ${marketFilter}
      ),
      with_ltv AS (
        SELECT
          lp.*,
          lp.ltv * 100 AS ltv_pct
        FROM latest_positions lp
        WHERE lp.rn = 1
      ),
      bucketed AS (
        SELECT
          um.contract_name AS market_name,
          mc.max_ltv,
          wl.ltv_pct,
          wl.position_value_usd,
          wl.user_debt,
          CASE
            WHEN wl.ltv_pct <= 50 THEN '0_50'
            WHEN wl.ltv_pct <= 70 THEN '50_70'
            WHEN wl.ltv_pct <= 80 THEN '70_80'
            WHEN wl.ltv_pct <= 90 THEN '80_90'
            WHEN wl.ltv_pct <= 100 THEN '90_plus'
            ELSE '100_plus'
          END AS bucket
        FROM with_ltv wl
        JOIN global.market_config mc ON mc.market_id = wl.market_id
        JOIN global.usg_markets um ON um.id = wl.market_id
      )
      SELECT
        market_name,
        max_ltv,
        bucket,
        COUNT(*)::bigint AS count,
        COALESCE(SUM(position_value_usd), 0) AS tvl,
        COALESCE(SUM(CASE WHEN bucket = '100_plus' THEN user_debt - position_value_usd ELSE 0 END), 0) AS bad_debt
      FROM bucketed
      GROUP BY market_name, max_ltv, bucket
      ORDER BY market_name, bucket
    `
  }
}
