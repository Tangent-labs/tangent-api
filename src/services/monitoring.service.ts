import { MonitoringRepository, BlockRow } from "../data/monitoring.data.js"
import { ParsedMonitoringQuery, resolveFiltersForModule } from "./monitoring/monitoring.filters.js"
import { getThresholds } from "./monitoring/monitoring.thresholds.js"
import {
  computePegStatus,
  computePriceVariationStatus,
  computeOracleSanityStatus,
  computeDebtUtilizationStatus,
  computeTvlVariationStatus,
  computeIndexerStaleStatus,
  computeIndexerFailureAccumulationStatus,
  computeIndexerHealthSli,
} from "./monitoring/monitoring.status.js"
import {
  MonitoringModuleName,
  MonitoringResponse,
  MODULE_CONFIG,
  CollateralizationItem,
  LiquidationDistanceItem,
  PegItem,
  PriceVariationItem,
  OracleSanityItem,
  DebtUtilizationItem,
  TvlVariationItem,
  LiquidationsModuleData,
  LtvDistributionItem,
  OverviewData,
  PaginatedResult,
  LtvBucket,
  MonitoringModuleDataMap,
  IndexerHealthItem,
  INDEXER_HEALTH_THRESHOLDS,
} from "./monitoring/monitoring.types.js"

interface CachedEntry<T> {
  data: T
  cached_at: string
}

interface CacheHelpers<T> {
  getLongCache: (key: string) => CachedEntry<T> | undefined
  setLongCache: (key: string, value: CachedEntry<T>, ttlMs?: number) => void
}

export class MonitoringService {
  private repo: MonitoringRepository
  private rpcUrl: string

  constructor(repo: MonitoringRepository) {
    this.repo = repo
    this.rpcUrl = process.env.RPC_URL || ""
  }

  private async fetchOnchainBlock(): Promise<{ blockNumber: number; blockTimestamp: number }> {
    if (!this.rpcUrl) return { blockNumber: 0, blockTimestamp: 0 }
    try {
      const numRes = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
      })
      const numJson = (await numRes.json()) as { result: string }
      const blockNumber = parseInt(numJson.result, 16)

      const blkRes = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBlockByNumber", params: [numJson.result, false], id: 2 }),
      })
      const blkJson = (await blkRes.json()) as { result: { timestamp: string } }
      const blockTimestamp = parseInt(blkJson.result.timestamp, 16)

      return { blockNumber, blockTimestamp }
    } catch {
      return { blockNumber: 0, blockTimestamp: 0 }
    }
  }

  async getModules(parsed: ParsedMonitoringQuery, cache: CacheHelpers<MonitoringModuleDataMap[MonitoringModuleName]>): Promise<MonitoringResponse> {
    const modules: Partial<MonitoringModuleDataMap> = {}
    const cachedAt: Partial<Record<MonitoringModuleName, string>> = {}

    const [blockRow, onchainBlock] = await Promise.all([this.repo.getMaxBlock(), this.fetchOnchainBlock()])

    const moduleHandlers: { [K in MonitoringModuleName]: () => Promise<MonitoringModuleDataMap[K]> } = {
      overview: () => this.getOverview(blockRow, onchainBlock),
      collateralization: () => this.getCollateralization(parsed),
      liquidation_distance: () => this.getLiquidationDistance(parsed),
      peg: () => this.getPeg(parsed),
      price_variation: () => this.getPriceVariation(parsed),
      oracle_sanity: () => this.getOracleSanity(parsed, onchainBlock.blockTimestamp),
      debt_utilization: () => this.getDebtUtilization(parsed),
      tvl_variation: () => this.getTvlVariation(parsed),
      liquidations: () => this.getLiquidations(parsed),
      ltv_distribution: () => this.getLtvDistribution(parsed),
      indexer_health: () => this.getIndexerHealth(parsed),
    }

    for (const moduleName of parsed.requestedModules) {
      const filters = resolveFiltersForModule(moduleName, parsed)
      const cacheKey = `monitoring:${moduleName}:${JSON.stringify(filters)}`

      if (!parsed.refresh) {
        const cached = cache.getLongCache(cacheKey)
        if (cached) {
          ;(modules as Record<string, MonitoringModuleDataMap[MonitoringModuleName]>)[moduleName] = cached.data
          cachedAt[moduleName] = cached.cached_at
          continue
        }
      }

      const handler = moduleHandlers[moduleName]
      if (handler) {
        const result = await handler()
        const now = new Date().toISOString()
        ;(modules as Record<string, MonitoringModuleDataMap[MonitoringModuleName]>)[moduleName] = result
        cache.setLongCache(cacheKey, { data: result, cached_at: now }, MODULE_CONFIG[moduleName].ttl * 1000)
        cachedAt[moduleName] = now
      }
    }

    return {
      cached_at: cachedAt,
      modules,
      requested_modules: parsed.requestedModules,
      filters_applied: {
        global: parsed.globalFilters,
        per_module: parsed.perModuleOverrides,
      },
    }
  }

  private async getOverview(blockRow: BlockRow | null, onchainBlock: { blockNumber: number; blockTimestamp: number }): Promise<OverviewData> {
    const thresholds = getThresholds()
    const positions = await this.repo.getOverviewPositions(thresholds.collateralization.warning_multiplier)

    const indexedBlock = blockRow ? Number(blockRow.block_id) : 0
    let indexerDelaySeconds = 0

    if (blockRow?.created_at && onchainBlock.blockTimestamp > 0) {
      const indexedBlockTimestamp = Math.round(blockRow.created_at.getTime() / 1000)
      indexerDelaySeconds = Math.max(0, onchainBlock.blockTimestamp - indexedBlockTimestamp)
    }

    return {
      active_positions: Number(positions.active_positions),
      at_risk_positions: Number(positions.at_risk_positions),
      indexed_block: indexedBlock,
      onchain_block: onchainBlock.blockNumber,
      indexer_delay_seconds: indexerDelaySeconds,
    }
  }

  private async getCollateralization(parsed: ParsedMonitoringQuery): Promise<PaginatedResult<CollateralizationItem>> {
    const filters = resolveFiltersForModule("collateralization", parsed)
    const t = getThresholds().collateralization

    const { rows, total } = await this.repo.getCollateralizationRows(filters, t.warning_multiplier, t.danger_multiplier, t.critical_multiplier)

    return {
      data: rows.map((r) => ({
        borrower_address: r.borrower_address,
        market_name: r.market_name,
        collateral_value: r.collateral_value,
        debt: r.debt,
        liquidation_threshold: r.liquidation_threshold,
        cr: r.cr,
        margin: r.margin,
        health_ratio: r.health_ratio,
        status: r.status as CollateralizationItem["status"],
      })),
      pagination: {
        offset: filters.offset,
        limit: filters.limit,
        total,
        has_more: filters.offset + filters.limit < total,
      },
    }
  }

  private async getLiquidationDistance(parsed: ParsedMonitoringQuery): Promise<PaginatedResult<LiquidationDistanceItem>> {
    const filters = resolveFiltersForModule("liquidation_distance", parsed)
    const t = getThresholds().liquidation_distance

    const { rows, total } = await this.repo.getLiquidationDistanceRows(filters, t.safe_pct, t.warning_pct, t.danger_pct)

    return {
      data: rows.map((r) => ({
        borrower_address: r.borrower_address,
        market_name: r.market_name,
        collateral_value: r.collateral_value,
        debt: r.debt,
        liquidation_price: r.liquidation_price,
        current_price: r.current_price,
        distance_pct: r.distance_pct,
        status: r.status as LiquidationDistanceItem["status"],
      })),
      pagination: {
        offset: filters.offset,
        limit: filters.limit,
        total,
        has_more: filters.offset + filters.limit < total,
      },
    }
  }

  private async getPeg(parsed: ParsedMonitoringQuery): Promise<PegItem[]> {
    const filters = resolveFiltersForModule("peg", parsed)
    const t = getThresholds().peg

    const rows = await this.repo.getPegRows()

    let items: PegItem[] = rows.map((r) => {
      const targetLabel = r.peg_type === "USD" ? "1 USD" : r.peg_type === "ETH" ? "1 ETH" : `1 ${r.peg_type}`
      return {
        symbol: r.symbol,
        peg_type: r.peg_type,
        target_label: targetLabel,
        spot_price: r.price,
        ref_price: r.ref_price,
        deviation_pct: r.deviation_pct,
        timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
        status: computePegStatus(r.deviation_pct, t),
      }
    })

    if (filters.asset) {
      items = items.filter((i) => i.symbol.toLowerCase() === filters.asset!.toLowerCase())
    }
    if (filters.status) {
      items = items.filter((i) => i.status === filters.status)
    }

    return items
  }

  private async getPriceVariation(parsed: ParsedMonitoringQuery): Promise<PriceVariationItem[]> {
    const filters = resolveFiltersForModule("price_variation", parsed)
    const t = getThresholds().price_variation

    const allRows = await this.repo.getPriceVariationRows()
    const filteredRows = filters.market_address ? allRows.filter((r) => r.market_address.toLowerCase() === filters.market_address!.toLowerCase()) : allRows

    let items: PriceVariationItem[] = filteredRows.map((r) => {
      const type = r.is_stable ? "stable" : "volatile"
      return {
        asset: r.asset,
        type,
        delta_5m: r.delta_5m,
        delta_15m: r.delta_15m,
        delta_1h: r.delta_1h,
        delta_4h: r.delta_4h,
        status: computePriceVariationStatus({ delta_5m: r.delta_5m, delta_15m: r.delta_15m, delta_1h: r.delta_1h, delta_4h: r.delta_4h }, type, t),
      }
    })

    if (filters.status) {
      items = items.filter((i) => i.status === filters.status)
    }

    return items
  }

  private async getOracleSanity(parsed: ParsedMonitoringQuery, onchainBlockTimestamp: number): Promise<OracleSanityItem[]> {
    const filters = resolveFiltersForModule("oracle_sanity", parsed)
    const t = getThresholds().oracle_sanity

    const allRows = await this.repo.getOracleSanityRows()
    const rows = filters.market_address ? allRows.filter((r) => r.market_address.toLowerCase() === filters.market_address!.toLowerCase()) : allRows

    let items: OracleSanityItem[] = rows.map((r) => {
      const snapshotEpoch = r.timestamp instanceof Date ? Math.round(r.timestamp.getTime() / 1000) : 0
      const ageSeconds = onchainBlockTimestamp > 0 ? Math.max(0, onchainBlockTimestamp - snapshotEpoch) : 0
      return {
        market_name: r.market_name,
        oracle_price: r.oracle_price,
        offchain_price: r.offchain_price,
        deviation_pct: r.deviation_pct,
        age_seconds: ageSeconds,
        status: computeOracleSanityStatus(r.deviation_pct, ageSeconds, t),
      }
    })

    if (filters.status) {
      items = items.filter((i) => i.status === filters.status)
    }

    return items
  }

  private async getDebtUtilization(parsed: ParsedMonitoringQuery): Promise<DebtUtilizationItem[]> {
    const filters = resolveFiltersForModule("debt_utilization", parsed)
    const t = getThresholds().debt_utilization

    const allRows = await this.repo.getDebtUtilizationRows()
    const rows = filters.market_address ? allRows.filter((r) => r.market_address.toLowerCase() === filters.market_address!.toLowerCase()) : allRows

    const items: DebtUtilizationItem[] = rows.map((r) => ({
      market_name: r.market_name,
      total_borrow: r.total_debt,
      max_debt: r.max_debt,
      utilization_pct: r.utilization_pct,
      status: computeDebtUtilizationStatus(r.utilization_pct, t),
    }))

    return items
  }

  private async getTvlVariation(parsed: ParsedMonitoringQuery): Promise<TvlVariationItem[]> {
    const filters = resolveFiltersForModule("tvl_variation", parsed)
    const t = getThresholds().tvl_variation

    const allRows = await this.repo.getTvlVariationRows()
    const rows = filters.market_address ? allRows.filter((r) => r.market_address.toLowerCase() === filters.market_address!.toLowerCase()) : allRows

    const items: TvlVariationItem[] = rows.map((r) => ({
      market_name: r.market_name,
      tvl_current: r.tvl_current,
      delta_1h_pct: r.delta_1h_pct,
      delta_24h_pct: r.delta_24h_pct,
      status: computeTvlVariationStatus(r.delta_1h_pct, r.delta_24h_pct, t),
    }))

    return items
  }

  private async getLiquidations(parsed: ParsedMonitoringQuery): Promise<LiquidationsModuleData> {
    const filters = resolveFiltersForModule("liquidations", parsed)
    const VALID_PERIODS = ["24h", "7d", "30d"] as const
    const period = filters.period || "24h"

    if (!VALID_PERIODS.includes(period as (typeof VALID_PERIODS)[number])) {
      throw new Error(`Invalid period "${period}". Must be one of: ${VALID_PERIODS.join(", ")}`)
    }

    const intervalMap: Record<string, string> = {
      "24h": "24 hours",
      "7d": "7 days",
      "30d": "30 days",
    }
    const periodInterval = intervalMap[period]

    const { rows, summary, total } = await this.repo.getLiquidationRows(filters, periodInterval)

    return {
      summary: {
        success_count: Number(summary.success_count),
        failure_count: Number(summary.failure_count),
        total_profit: summary.total_profit ? `+$${Number(summary.total_profit).toFixed(0)}` : "$0",
        total_bad_debt: summary.total_bad_debt ? `$${Number(summary.total_bad_debt).toFixed(0)}` : "$0",
      },
      data: rows.map((r) => ({
        date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
        borrower: r.borrower,
        market: r.market,
        type: r.type,
        collateral_liquidated: r.collateral_liquidated || "$0",
        profit: r.profit || "$0",
        success: r.success,
        tx_hash: r.tx_hash || "",
      })),
      pagination: {
        offset: filters.offset,
        limit: filters.limit,
        total,
        has_more: filters.offset + filters.limit < total,
      },
    }
  }

  private async getLtvDistribution(parsed: ParsedMonitoringQuery): Promise<LtvDistributionItem[]> {
    const filters = resolveFiltersForModule("ltv_distribution", parsed)

    const rows = await this.repo.getLtvDistributionRows(filters.market_address)

    const marketMap = new Map<string, LtvDistributionItem>()

    for (const row of rows) {
      if (!marketMap.has(row.market_name)) {
        marketMap.set(row.market_name, {
          market_name: row.market_name,
          max_ltv: row.max_ltv,
          buckets: {
            "0_50": { count: 0, tvl: 0 },
            "50_70": { count: 0, tvl: 0 },
            "70_80": { count: 0, tvl: 0 },
            "80_90": { count: 0, tvl: 0 },
            "90_plus": { count: 0, tvl: 0 },
            "100_plus": { count: 0, bad_debt: 0 },
          },
          total_positions: 0,
          total_tvl: 0,
        })
      }

      const item = marketMap.get(row.market_name)!
      const bucketKey = row.bucket as keyof LtvDistributionItem["buckets"]

      if (bucketKey in item.buckets) {
        const bucket = item.buckets[bucketKey] as LtvBucket
        bucket.count = Number(row.count)
        if (bucketKey === "100_plus") {
          bucket.bad_debt = row.bad_debt
        } else {
          bucket.tvl = row.tvl
        }
      }

      item.total_positions += Number(row.count)
      if (bucketKey !== "100_plus") {
        item.total_tvl += row.tvl
      }
    }

    return Array.from(marketMap.values())
  }

  private async getIndexerHealth(parsed: ParsedMonitoringQuery): Promise<IndexerHealthItem[]> {
    resolveFiltersForModule("indexer_health", parsed)

    const indexerEntries = Object.entries(INDEXER_HEALTH_THRESHOLDS.indexers).filter(([, config]) => config.enabled)
    const rows = await this.repo.getIndexerHealthRows(indexerEntries.map(([indexerName]) => indexerName))
    const rowsByIndexer = new Map(rows.map((row) => [row.indexer_name, row]))
    const now = new Date()

    return indexerEntries.map(([indexerName, config]) => {
      const row = rowsByIndexer.get(indexerName)
      const latestSuccessFinishedAt = row?.latest_success_finished_at ?? null
      const failStreakCount = Number(row?.fail_streak_count ?? 0)

      return {
        indexer_name: indexerName,
        enabled: config.enabled,
        latest_status: row?.latest_status ?? null,
        latest_finished_at: row?.latest_finished_at ? row.latest_finished_at.toISOString() : null,
        exec_1h: Number(row?.exec_1h ?? 0),
        failure_1h: Number(row?.failure_1h ?? 0),
        exec_12h: Number(row?.exec_12h ?? 0),
        failure_12h: Number(row?.failure_12h ?? 0),
        exec_24h: Number(row?.exec_24h ?? 0),
        failure_24h: Number(row?.failure_24h ?? 0),
        fail_streak_count: failStreakCount,
        status_stale: computeIndexerStaleStatus(latestSuccessFinishedAt, now, config),
        status_failure_accumulation: computeIndexerFailureAccumulationStatus(failStreakCount, config),
        sli: computeIndexerHealthSli(latestSuccessFinishedAt, failStreakCount, now, config),
      }
    })
  }
}
