export const ALL_MODULES = [
  "overview",
  "collateralization",
  "liquidation_distance",
  "peg",
  "price_variation",
  "oracle_sanity",
  "debt_utilization",
  "tvl_variation",
  "liquidations",
  "ltv_distribution",
] as const

export type MonitoringModuleName = (typeof ALL_MODULES)[number]

export interface MonitoringModuleConfig {
  ttl: number
  filters: readonly (keyof ModuleFilters)[]
  paginated: boolean
  thresholds?: Record<string, number | Record<string, number>>
}

function envFloat(key: string, fallback: number): number {
  const val = process.env[key]
  if (val === undefined || val === "") return fallback
  const parsed = parseFloat(val)
  return isNaN(parsed) ? fallback : parsed
}

export const MODULE_CONFIG = {
  overview: {
    ttl: 120,
    filters: [],
    paginated: false,
  },
  collateralization: {
    ttl: 60,
    filters: ["market_address", "borrower_address", "status"],
    paginated: true,
    thresholds: {
      warning_multiplier: envFloat("MONITORING_COLLAT_WARNING_MULT", 1.2),
      danger_multiplier: envFloat("MONITORING_COLLAT_DANGER_MULT", 1.1),
      critical_multiplier: envFloat("MONITORING_COLLAT_CRITICAL_MULT", 1.03),
    },
  },
  liquidation_distance: {
    ttl: 60,
    filters: ["market_address", "borrower_address", "status"],
    paginated: true,
    thresholds: {
      safe_pct: envFloat("MONITORING_LIQDIST_SAFE_PCT", 5.0),
      warning_pct: envFloat("MONITORING_LIQDIST_WARNING_PCT", 2.0),
      danger_pct: envFloat("MONITORING_LIQDIST_DANGER_PCT", 1.0),
      critical_pct: envFloat("MONITORING_LIQDIST_CRITICAL_PCT", 0.5),
    },
  },
  peg: {
    ttl: 60,
    filters: ["status", "asset"],
    paginated: false,
    thresholds: {
      safe_pct: envFloat("MONITORING_PEG_SAFE_PCT", 0.5),
      warning_pct: envFloat("MONITORING_PEG_WARNING_PCT", 2.0),
      danger_pct: envFloat("MONITORING_PEG_DANGER_PCT", 5.0),
    },
  },
  price_variation: {
    ttl: 60,
    filters: ["market_address", "status"],
    paginated: false,
    thresholds: {
      stable: {
        "5m": envFloat("MONITORING_PRICEVAR_STABLE_5M", 0.3),
        "15m": envFloat("MONITORING_PRICEVAR_STABLE_15M", 0.5),
        "1h": envFloat("MONITORING_PRICEVAR_STABLE_1H", 1.0),
        "4h": envFloat("MONITORING_PRICEVAR_STABLE_4H", 2.0),
      },
      volatile: {
        "5m": envFloat("MONITORING_PRICEVAR_VOLATILE_5M", 2.0),
        "15m": envFloat("MONITORING_PRICEVAR_VOLATILE_15M", 5.0),
        "1h": envFloat("MONITORING_PRICEVAR_VOLATILE_1H", 10.0),
        "4h": envFloat("MONITORING_PRICEVAR_VOLATILE_4H", 15.0),
      },
    },
  },
  oracle_sanity: {
    ttl: 60,
    filters: ["market_address", "status"],
    paginated: false,
    thresholds: {
      deviation_warning_pct: envFloat("MONITORING_ORACLE_DEV_WARNING_PCT", 2.0),
      deviation_danger_pct: envFloat("MONITORING_ORACLE_DEV_DANGER_PCT", 5.0),
      max_age_warning_seconds: envFloat("MONITORING_ORACLE_AGE_WARNING_S", 3600),
      max_age_danger_seconds: envFloat("MONITORING_ORACLE_AGE_DANGER_S", 7200),
    },
  },
  debt_utilization: {
    ttl: 60,
    filters: ["market_address"],
    paginated: false,
    thresholds: {
      warning_pct: envFloat("MONITORING_DEBT_WARNING_PCT", 85.0),
      danger_pct: envFloat("MONITORING_DEBT_DANGER_PCT", 95.0),
    },
  },
  tvl_variation: {
    ttl: 60,
    filters: ["market_address"],
    paginated: false,
    thresholds: {
      warning_1h_pct: envFloat("MONITORING_TVL_WARNING_1H_PCT", 10.0),
      danger_1h_pct: envFloat("MONITORING_TVL_DANGER_1H_PCT", 15.0),
      warning_24h_pct: envFloat("MONITORING_TVL_WARNING_24H_PCT", 20.0),
      danger_24h_pct: envFloat("MONITORING_TVL_DANGER_24H_PCT", 30.0),
    },
  },
  liquidations: {
    ttl: 60,
    filters: ["market_address", "borrower_address"],
    paginated: true,
  },
  ltv_distribution: {
    ttl: 60,
    filters: ["market_address"],
    paginated: false,
  },
} satisfies Record<MonitoringModuleName, MonitoringModuleConfig>

export interface PaginationMeta {
  offset: number
  limit: number
  total: number
  has_more: boolean
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: PaginationMeta
}

export interface OverviewData {
  active_positions: number
  at_risk_positions: number
  indexed_block: number
  onchain_block: number
  indexer_delay_seconds: number
}

export interface CollateralizationItem {
  borrower_address: string
  market_name: string
  collateral_value: number
  debt: number
  liquidation_threshold: number
  cr: number
  margin: number
  health_ratio: number
  status: "safe" | "warning" | "danger" | "critical"
}

export interface LiquidationDistanceItem {
  borrower_address: string
  market_name: string
  collateral_value: number
  debt: number
  liquidation_price: number
  current_price: number
  distance_pct: number
  status: "safe" | "warning" | "danger" | "critical"
}

export interface PegItem {
  symbol: string
  peg_type: string
  target_label: string
  spot_price: number
  ref_price: number
  deviation_pct: number
  timestamp: string
  status: "pegged" | "drift" | "danger" | "critical"
}

export interface PriceVariationItem {
  asset: string
  type: "stable" | "volatile"
  delta_5m: number
  delta_15m: number
  delta_1h: number
  delta_4h: number
  status: "ok" | "watch" | "danger" | "critical"
}

export interface OracleSanityItem {
  market_name: string
  oracle_price: number
  offchain_price: number
  deviation_pct: number
  age_seconds: number
  status: "ok" | "watch" | "danger" | "critical"
}

export interface DebtUtilizationItem {
  market_name: string
  total_borrow: number
  max_debt: number
  utilization_pct: number
  status: "ok" | "warning" | "danger"
}

export interface TvlVariationItem {
  market_name: string
  tvl_current: number
  delta_1h_pct: number
  delta_24h_pct: number
  status: "ok" | "warning" | "danger"
}

export interface LiquidationsSummary {
  success_count: number
  failure_count: number
  total_profit: string
  total_bad_debt: string
}

export interface LiquidationItem {
  date: string
  borrower: string
  market: string
  type: string
  collateral_liquidated: string
  profit: string
  success: boolean
  tx_hash: string
}

export interface LiquidationsModuleData {
  summary: LiquidationsSummary
  data: LiquidationItem[]
  pagination: PaginationMeta
}

export interface LtvBucket {
  count: number
  tvl?: number
  bad_debt?: number
}

export interface LtvDistributionItem {
  market_name: string
  max_ltv: number
  buckets: {
    "0_50": LtvBucket
    "50_70": LtvBucket
    "70_80": LtvBucket
    "80_90": LtvBucket
    "90_plus": LtvBucket
    "100_plus": LtvBucket
  }
  total_positions: number
  total_tvl: number
}

export interface ModuleFilters {
  market_address?: string
  borrower_address?: string
  status?: string
  offset: number
  limit: number
  sort_by?: "cr" | "margin"
  period?: "24h" | "7d" | "30d"
  asset?: string
}

export interface MonitoringModuleDataMap {
  overview: OverviewData
  collateralization: PaginatedResult<CollateralizationItem>
  liquidation_distance: PaginatedResult<LiquidationDistanceItem>
  peg: PegItem[]
  price_variation: PriceVariationItem[]
  oracle_sanity: OracleSanityItem[]
  debt_utilization: DebtUtilizationItem[]
  tvl_variation: TvlVariationItem[]
  liquidations: LiquidationsModuleData
  ltv_distribution: LtvDistributionItem[]
}

export interface MonitoringResponse {
  cached_at: Partial<Record<MonitoringModuleName, string>>
  modules: Partial<MonitoringModuleDataMap>
  requested_modules: MonitoringModuleName[]
  filters_applied: {
    global: Record<string, string | number>
    per_module: Record<string, Record<string, string | number>>
  }
}

export type MonitoringThresholds = {
  [K in keyof typeof MODULE_CONFIG as (typeof MODULE_CONFIG)[K] extends { thresholds: Record<string, unknown> }
    ? K
    : never]: (typeof MODULE_CONFIG)[K] extends {
    thresholds: infer T
  }
    ? T
    : never
}
