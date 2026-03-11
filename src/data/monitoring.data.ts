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
      SELECT DISTINCT ON (pmt.id)
        pmt.symbol,
        pmt.peg_type,
        pss.price,
        pss.ref_price,
        pss.deviation_pct,
        pss.timestamp
      FROM global.peg_monitored_tokens pmt
      JOIN global.peg_sanity_snapshots pss ON pss.token_id = pmt.id
      WHERE pmt.active = true
      ORDER BY pmt.id, pss.timestamp DESC
    `
  }

  async getOracleSanityRows(): Promise<OracleSanityRow[]> {
    return await this.prismaClient.$queryRaw<OracleSanityRow[]>`
      SELECT DISTINCT ON (oss.market_id)
        um.contract_address AS market_address,
        um.contract_name AS market_name,
        oss.oracle_price,
        oss.offchain_price,
        oss.deviation_pct,
        oss.timestamp
      FROM global.oracle_sanity_snapshots oss
      JOIN global.usg_markets um ON um.id = oss.market_id
      WHERE um.is_active = true
      ORDER BY oss.market_id, oss.timestamp DESC
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
      WITH current_data AS (
        SELECT lgd.market_id, lgd.tvl_usd AS tvl_current, um.contract_name AS market_name, um.contract_address AS market_address
        FROM global.latest_global_data lgd
        JOIN global.usg_markets um ON um.id = lgd.market_id
        WHERE um.is_active = true
      ),
      hist_1h AS (
        SELECT DISTINCT ON (mgd.market_id)
          mgd.market_id, mgd.tvl_usd
        FROM global.market_global_data mgd
        WHERE mgd.timestamp <= NOW() - INTERVAL '1 hour'
        ORDER BY mgd.market_id, mgd.timestamp DESC
      ),
      hist_24h AS (
        SELECT DISTINCT ON (mgd.market_id)
          mgd.market_id, mgd.tvl_usd
        FROM global.market_global_data mgd
        WHERE mgd.timestamp <= NOW() - INTERVAL '24 hours'
        ORDER BY mgd.market_id, mgd.timestamp DESC
      )
      SELECT
        cd.market_address,
        cd.market_name,
        cd.tvl_current,
        CASE WHEN h1.tvl_usd > 0
          THEN ((cd.tvl_current - h1.tvl_usd) / h1.tvl_usd * 100)
          ELSE 0
        END AS delta_1h_pct,
        CASE WHEN h24.tvl_usd > 0
          THEN ((cd.tvl_current - h24.tvl_usd) / h24.tvl_usd * 100)
          ELSE 0
        END AS delta_24h_pct
      FROM current_data cd
      LEFT JOIN hist_1h h1 ON h1.market_id = cd.market_id
      LEFT JOIN hist_24h h24 ON h24.market_id = cd.market_id
    `
  }

  async getPriceVariationRows(): Promise<PriceVariationRow[]> {
    return await this.prismaClient.$queryRaw<PriceVariationRow[]>`
      WITH latest_oracle AS (
        SELECT DISTINCT ON (oss.market_id)
          oss.market_id,
          um.contract_name AS asset,
          um.contract_address AS market_address,
          oss.oracle_price AS price_now,
          oss.timestamp AS ts_now
        FROM global.oracle_sanity_snapshots oss
        JOIN global.usg_markets um ON um.id = oss.market_id
        WHERE um.is_active = true
        ORDER BY oss.market_id, oss.timestamp DESC
      ),
      hist_5m AS (
        SELECT DISTINCT ON (oss.market_id)
          oss.market_id, oss.oracle_price
        FROM global.oracle_sanity_snapshots oss
        JOIN latest_oracle lo ON lo.market_id = oss.market_id
        WHERE oss.timestamp <= lo.ts_now - INTERVAL '5 minutes'
        ORDER BY oss.market_id, oss.timestamp DESC
      ),
      hist_15m AS (
        SELECT DISTINCT ON (oss.market_id)
          oss.market_id, oss.oracle_price
        FROM global.oracle_sanity_snapshots oss
        JOIN latest_oracle lo ON lo.market_id = oss.market_id
        WHERE oss.timestamp <= lo.ts_now - INTERVAL '15 minutes'
        ORDER BY oss.market_id, oss.timestamp DESC
      ),
      hist_1h AS (
        SELECT DISTINCT ON (oss.market_id)
          oss.market_id, oss.oracle_price
        FROM global.oracle_sanity_snapshots oss
        JOIN latest_oracle lo ON lo.market_id = oss.market_id
        WHERE oss.timestamp <= lo.ts_now - INTERVAL '1 hour'
        ORDER BY oss.market_id, oss.timestamp DESC
      ),
      hist_4h AS (
        SELECT DISTINCT ON (oss.market_id)
          oss.market_id, oss.oracle_price
        FROM global.oracle_sanity_snapshots oss
        JOIN latest_oracle lo ON lo.market_id = oss.market_id
        WHERE oss.timestamp <= lo.ts_now - INTERVAL '4 hours'
        ORDER BY oss.market_id, oss.timestamp DESC
      ),
      stable_tokens AS (
        SELECT DISTINCT symbol FROM global.peg_monitored_tokens WHERE peg_type = 'USD' AND active = true
      )
      SELECT
        lo.market_address,
        lo.asset,
        (EXISTS (SELECT 1 FROM stable_tokens st WHERE lo.asset ILIKE '%' || st.symbol || '%')) AS is_stable,
        CASE WHEN h5.oracle_price > 0
          THEN ((lo.price_now - h5.oracle_price) / h5.oracle_price * 100)
          ELSE 0
        END AS delta_5m,
        CASE WHEN h15.oracle_price > 0
          THEN ((lo.price_now - h15.oracle_price) / h15.oracle_price * 100)
          ELSE 0
        END AS delta_15m,
        CASE WHEN h1h.oracle_price > 0
          THEN ((lo.price_now - h1h.oracle_price) / h1h.oracle_price * 100)
          ELSE 0
        END AS delta_1h,
        CASE WHEN h4h.oracle_price > 0
          THEN ((lo.price_now - h4h.oracle_price) / h4h.oracle_price * 100)
          ELSE 0
        END AS delta_4h
      FROM latest_oracle lo
      LEFT JOIN hist_5m h5 ON h5.market_id = lo.market_id
      LEFT JOIN hist_15m h15 ON h15.market_id = lo.market_id
      LEFT JOIN hist_1h h1h ON h1h.market_id = lo.market_id
      LEFT JOIN hist_4h h4h ON h4h.market_id = lo.market_id
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
      bucketed AS (
        SELECT
          um.contract_name AS market_name,
          mc.max_ltv,
          lp.ltv,
          lp.position_value_usd,
          lp.user_debt,
          CASE
            WHEN lp.ltv <= 50 THEN '0_50'
            WHEN lp.ltv <= 70 THEN '50_70'
            WHEN lp.ltv <= 80 THEN '70_80'
            WHEN lp.ltv <= 90 THEN '80_90'
            WHEN lp.ltv <= 100 THEN '90_plus'
            ELSE '100_plus'
          END AS bucket
        FROM latest_positions lp
        JOIN global.market_config mc ON mc.market_id = lp.market_id
        JOIN global.usg_markets um ON um.id = lp.market_id
        WHERE lp.rn = 1
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
