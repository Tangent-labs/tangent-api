import { MODULE_CONFIG, MonitoringThresholds } from "./monitoring.types.js"

export function getThresholds(): MonitoringThresholds {
  return {
    collateralization: MODULE_CONFIG.collateralization.thresholds,
    liquidation_distance: MODULE_CONFIG.liquidation_distance.thresholds,
    peg: MODULE_CONFIG.peg.thresholds,
    price_variation: MODULE_CONFIG.price_variation.thresholds,
    oracle_sanity: MODULE_CONFIG.oracle_sanity.thresholds,
    debt_utilization: MODULE_CONFIG.debt_utilization.thresholds,
    tvl_variation: MODULE_CONFIG.tvl_variation.thresholds,
    indexer_health: MODULE_CONFIG.indexer_health.thresholds,
  }
}
