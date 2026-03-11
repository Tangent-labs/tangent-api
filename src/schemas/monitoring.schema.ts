import { RouteShorthandOptions } from "fastify"

// ---------------------------------------------------------------------------
// Shared fragments
// ---------------------------------------------------------------------------

const paginationMeta = {
  type: "object",
  properties: {
    offset: { type: "integer" },
    limit: { type: "integer" },
    total: { type: "integer" },
    has_more: { type: "boolean" },
  },
  required: ["offset", "limit", "total", "has_more"],
} as const

const errorResponse = {
  type: "object",
  properties: { error: { type: "string" } },
} as const

// ---------------------------------------------------------------------------
// Module item schemas
// ---------------------------------------------------------------------------

const overviewData = {
  type: "object",
  properties: {
    active_positions: { type: "integer" },
    at_risk_positions: { type: "integer" },
    indexed_block: { type: "integer" },
    onchain_block: { type: "integer" },
    indexer_delay_seconds: { type: "number" },
  },
} as const

const collateralizationItem = {
  type: "object",
  properties: {
    borrower_address: { type: "string" },
    market_name: { type: "string" },
    collateral_value: { type: "number" },
    debt: { type: "number" },
    liquidation_threshold: { type: "number" },
    cr: { type: "number" },
    margin: { type: "number" },
    health_ratio: { type: "number" },
    status: { type: "string", enum: ["safe", "warning", "danger", "critical"] },
  },
} as const

const liquidationDistanceItem = {
  type: "object",
  properties: {
    borrower_address: { type: "string" },
    market_name: { type: "string" },
    collateral_value: { type: "number" },
    debt: { type: "number" },
    liquidation_price: { type: "number" },
    current_price: { type: "number" },
    distance_pct: { type: "number" },
    status: { type: "string", enum: ["safe", "warning", "danger", "critical"] },
  },
} as const

const pegItem = {
  type: "object",
  properties: {
    symbol: { type: "string" },
    peg_type: { type: "string" },
    target_label: { type: "string" },
    spot_price: { type: "number" },
    ref_price: { type: "number" },
    deviation_pct: { type: "number" },
    status: { type: "string", enum: ["pegged", "drift", "danger", "critical"] },
  },
} as const

const priceVariationItem = {
  type: "object",
  properties: {
    asset: { type: "string" },
    type: { type: "string", enum: ["stable", "volatile"] },
    delta_5m: { type: "number" },
    delta_15m: { type: "number" },
    delta_1h: { type: "number" },
    delta_4h: { type: "number" },
    status: { type: "string", enum: ["ok", "watch", "danger", "critical"] },
  },
} as const

const oracleSanityItem = {
  type: "object",
  properties: {
    market_name: { type: "string" },
    oracle_price: { type: "number" },
    offchain_price: { type: "number" },
    deviation_pct: { type: "number" },
    age_seconds: { type: "number" },
    status: { type: "string", enum: ["ok", "watch", "danger", "critical"] },
  },
} as const

const debtUtilizationItem = {
  type: "object",
  properties: {
    market_name: { type: "string" },
    total_borrow: { type: "number" },
    max_debt: { type: "number" },
    utilization_pct: { type: "number" },
    status: { type: "string", enum: ["ok", "warning", "danger"] },
  },
} as const

const tvlVariationItem = {
  type: "object",
  properties: {
    market_name: { type: "string" },
    tvl_current: { type: "number" },
    delta_1h_pct: { type: "number" },
    delta_24h_pct: { type: "number" },
    status: { type: "string", enum: ["ok", "warning", "danger"] },
  },
} as const

const liquidationsModuleData = {
  type: "object",
  properties: {
    summary: {
      type: "object",
      properties: {
        success_count: { type: "integer" },
        failure_count: { type: "integer" },
        total_profit: { type: "string" },
        total_bad_debt: { type: "string" },
      },
    },
    data: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          borrower: { type: "string" },
          market: { type: "string" },
          type: { type: "string" },
          collateral_liquidated: { type: "string" },
          profit: { type: "string" },
          success: { type: "boolean" },
          tx_hash: { type: "string" },
        },
      },
    },
    pagination: paginationMeta,
  },
} as const

const ltvBucket = {
  type: "object",
  properties: {
    count: { type: "integer" },
    tvl: { type: "number" },
    bad_debt: { type: "number" },
  },
} as const

const ltvDistributionItem = {
  type: "object",
  properties: {
    market_name: { type: "string" },
    max_ltv: { type: "number" },
    buckets: {
      type: "object",
      properties: {
        "0_50": ltvBucket,
        "50_70": ltvBucket,
        "70_80": ltvBucket,
        "80_90": ltvBucket,
        "90_plus": ltvBucket,
        "100_plus": ltvBucket,
      },
    },
    total_positions: { type: "integer" },
    total_tvl: { type: "number" },
  },
} as const

function paginatedResult(itemSchema: Record<string, unknown>) {
  return {
    type: "object",
    properties: {
      data: { type: "array", items: itemSchema },
      pagination: paginationMeta,
    },
  }
}

// ---------------------------------------------------------------------------
// Module names enum
// ---------------------------------------------------------------------------

const moduleNameEnum = {
  type: "string",
  enum: [
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
  ],
} as const

// ---------------------------------------------------------------------------
// GET /monitoring
// ---------------------------------------------------------------------------

export const monitoringSchema: RouteShorthandOptions = {
  schema: {
    querystring: {
      type: "object",
      properties: {
        modules: {
          type: "string",
          description: "CSV of module names or 'all'",
          pattern:
            "^(all|((overview|collateralization|liquidation_distance|peg|price_variation|oracle_sanity|debt_utilization|tvl_variation|liquidations|ltv_distribution)(,(overview|collateralization|liquidation_distance|peg|price_variation|oracle_sanity|debt_utilization|tvl_variation|liquidations|ltv_distribution))*))$",
        },
        market_address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
        borrower_address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
        status: {
          type: "string",
          enum: ["safe", "warning", "danger", "critical", "pegged", "drift", "ok", "watch"],
        },
        asset: { type: "string", minLength: 1, maxLength: 20 },
        offset: { type: "integer", minimum: 0, default: 0 },
        limit: { type: "integer", minimum: 1, maximum: 200, default: 10 },
        refresh: { type: "string", enum: ["true", "false"] },
      },
      additionalProperties: true,
    },
    tags: ["monitoring"],
    summary: "Get monitoring data",
    response: {
      200: {
        type: "object",
        properties: {
          cached_at: {
            type: "object",
            description: "ISO timestamp of when each module's data was cached or fetched.",
            properties: {
              overview: { type: "string", format: "date-time" },
              collateralization: { type: "string", format: "date-time" },
              liquidation_distance: { type: "string", format: "date-time" },
              peg: { type: "string", format: "date-time" },
              price_variation: { type: "string", format: "date-time" },
              oracle_sanity: { type: "string", format: "date-time" },
              debt_utilization: { type: "string", format: "date-time" },
              tvl_variation: { type: "string", format: "date-time" },
              liquidations: { type: "string", format: "date-time" },
              ltv_distribution: { type: "string", format: "date-time" },
            },
          },
          modules: {
            type: "object",
            description: "Each key is a module name. Only requested modules are present.",
            properties: {
              overview: overviewData,
              collateralization: paginatedResult(collateralizationItem),
              liquidation_distance: paginatedResult(liquidationDistanceItem),
              peg: { type: "array", items: pegItem },
              price_variation: { type: "array", items: priceVariationItem },
              oracle_sanity: { type: "array", items: oracleSanityItem },
              debt_utilization: { type: "array", items: debtUtilizationItem },
              tvl_variation: { type: "array", items: tvlVariationItem },
              liquidations: liquidationsModuleData,
              ltv_distribution: { type: "array", items: ltvDistributionItem },
            },
            additionalProperties: false,
          },
          requested_modules: {
            type: "array",
            items: moduleNameEnum,
          },
          filters_applied: {
            type: "object",
            properties: {
              global: { type: "object", additionalProperties: { type: ["string", "number"] } },
              per_module: {
                type: "object",
                additionalProperties: {
                  type: "object",
                  additionalProperties: { type: ["string", "number"] },
                },
              },
            },
          },
        },
        required: ["cached_at", "modules", "requested_modules", "filters_applied"],
      },
      500: errorResponse,
    },
  },
}

// ---------------------------------------------------------------------------
// Threshold sub-schemas
// ---------------------------------------------------------------------------

const thresholdRange = {
  type: "object",
  additionalProperties: { type: "number" },
} as const

// ---------------------------------------------------------------------------
// GET /monitoring/thresholds
// ---------------------------------------------------------------------------

export const thresholdsGetSchema: RouteShorthandOptions = {
  schema: {
    tags: ["monitoring"],
    summary: "Get monitoring thresholds (read-only, configured via env vars)",
    response: {
      200: {
        type: "object",
        properties: {
          collateralization: {
            type: "object",
            properties: {
              warning_multiplier: { type: "number" },
              danger_multiplier: { type: "number" },
              critical_multiplier: { type: "number" },
            },
          },
          liquidation_distance: {
            type: "object",
            properties: {
              safe_pct: { type: "number" },
              warning_pct: { type: "number" },
              danger_pct: { type: "number" },
              critical_pct: { type: "number" },
            },
          },
          peg: {
            type: "object",
            properties: {
              safe_pct: { type: "number" },
              warning_pct: { type: "number" },
              danger_pct: { type: "number" },
            },
          },
          price_variation: {
            type: "object",
            properties: {
              stable: thresholdRange,
              volatile: thresholdRange,
            },
          },
          oracle_sanity: {
            type: "object",
            properties: {
              deviation_warning_pct: { type: "number" },
              deviation_danger_pct: { type: "number" },
              max_age_warning_seconds: { type: "number" },
              max_age_danger_seconds: { type: "number" },
            },
          },
          debt_utilization: {
            type: "object",
            properties: {
              warning_pct: { type: "number" },
              danger_pct: { type: "number" },
            },
          },
          tvl_variation: {
            type: "object",
            properties: {
              warning_1h_pct: { type: "number" },
              danger_1h_pct: { type: "number" },
              warning_24h_pct: { type: "number" },
              danger_24h_pct: { type: "number" },
            },
          },
        },
        required: ["collateralization", "liquidation_distance", "peg", "price_variation", "oracle_sanity", "debt_utilization", "tvl_variation"],
      },
    },
  },
}
