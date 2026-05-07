import { IndexerHealthConfig, IndexerHealthSeverity, MonitoringThresholds } from "./monitoring.types.js"

export function computeCollateralizationStatus(
  cr: number,
  liquidationThreshold: number,
  t: MonitoringThresholds["collateralization"]
): "safe" | "warning" | "danger" | "critical" {
  if (cr >= liquidationThreshold * t.warning_multiplier) return "safe"
  if (cr >= liquidationThreshold * t.danger_multiplier) return "warning"
  if (cr >= liquidationThreshold * t.critical_multiplier) return "danger"
  return "critical"
}

export function computeLiquidationDistanceStatus(
  distancePct: number,
  t: MonitoringThresholds["liquidation_distance"]
): "safe" | "warning" | "danger" | "critical" {
  if (distancePct >= t.safe_pct) return "safe"
  if (distancePct >= t.warning_pct) return "warning"
  if (distancePct >= t.danger_pct) return "danger"
  return "critical"
}

export function computePegStatus(deviationPct: number, t: MonitoringThresholds["peg"]): "pegged" | "drift" | "danger" | "critical" {
  const abs = Math.abs(deviationPct)
  if (abs < t.safe_pct) return "pegged"
  if (abs < t.warning_pct) return "drift"
  if (abs < t.danger_pct) return "danger"
  return "critical"
}

export function computePriceVariationStatus(
  deltas: { delta_5m: number; delta_15m: number; delta_1h: number; delta_4h: number },
  type: "stable" | "volatile",
  t: MonitoringThresholds["price_variation"]
): "ok" | "watch" | "danger" | "critical" {
  const thresholds = t[type]
  const pairs: [number, number][] = [
    [Math.abs(deltas.delta_5m), thresholds["5m"]],
    [Math.abs(deltas.delta_15m), thresholds["15m"]],
    [Math.abs(deltas.delta_1h), thresholds["1h"]],
    [Math.abs(deltas.delta_4h), thresholds["4h"]],
  ]

  let maxRatio = 0
  for (const [absVal, threshold] of pairs) {
    if (threshold > 0) {
      maxRatio = Math.max(maxRatio, absVal / threshold)
    }
  }

  if (maxRatio >= 3) return "critical"
  if (maxRatio >= 2) return "danger"
  if (maxRatio >= 1) return "watch"
  return "ok"
}

export function computeOracleSanityStatus(
  deviationPct: number,
  ageSeconds: number,
  t: MonitoringThresholds["oracle_sanity"]
): "ok" | "watch" | "danger" | "critical" {
  let deviationStatus: "ok" | "watch" | "danger"
  if (Math.abs(deviationPct) < t.deviation_warning_pct) deviationStatus = "ok"
  else if (Math.abs(deviationPct) < t.deviation_danger_pct) deviationStatus = "watch"
  else deviationStatus = "danger"

  let ageStatus: "ok" | "watch" | "danger"
  if (ageSeconds < t.max_age_warning_seconds) ageStatus = "ok"
  else if (ageSeconds < t.max_age_danger_seconds) ageStatus = "watch"
  else ageStatus = "danger"

  if (deviationStatus === "danger" && ageStatus === "danger") return "critical"

  const order = { ok: 0, watch: 1, danger: 2 }
  return order[deviationStatus] >= order[ageStatus] ? deviationStatus : ageStatus
}

export function computeDebtUtilizationStatus(utilizationPct: number, t: MonitoringThresholds["debt_utilization"]): "ok" | "warning" | "danger" {
  if (utilizationPct < t.warning_pct) return "ok"
  if (utilizationPct < t.danger_pct) return "warning"
  return "danger"
}

export function computeTvlVariationStatus(delta1hPct: number, delta24hPct: number, t: MonitoringThresholds["tvl_variation"]): "ok" | "warning" | "danger" {
  const absDelta1h = Math.abs(delta1hPct)
  const absDelta24h = Math.abs(delta24hPct)
  const dangerThreshold1h = Math.abs(t.danger_1h_pct)
  const warningThreshold1h = Math.abs(t.warning_1h_pct)
  const dangerThreshold24h = Math.abs(t.danger_24h_pct)
  const warningThreshold24h = Math.abs(t.warning_24h_pct)

  if (absDelta1h >= dangerThreshold1h || absDelta24h >= dangerThreshold24h) return "danger"
  if (absDelta1h >= warningThreshold1h || absDelta24h >= warningThreshold24h) return "warning"
  return "ok"
}

export function computeIndexerStaleStatus(
  latestSuccessfulFinishedAt: Date | string | null,
  now: Date,
  t: IndexerHealthConfig
): IndexerHealthSeverity {
  if (!latestSuccessfulFinishedAt) return "unknown"

  const latestSuccess = latestSuccessfulFinishedAt instanceof Date ? latestSuccessfulFinishedAt : new Date(latestSuccessfulFinishedAt)
  const ageMinutes = Math.max(0, (now.getTime() - latestSuccess.getTime()) / 60000)

  if (ageMinutes >= t.critical_after_minutes) return "critical"
  if (ageMinutes >= t.warning_after_minutes) return "warning"
  return "ok"
}

export function computeIndexerFailureAccumulationStatus(
  failStreakCount: number,
  t: IndexerHealthConfig
): Exclude<IndexerHealthSeverity, "unknown"> {
  if (failStreakCount >= t.max_consecutive_failures) return "critical"
  if (failStreakCount > 0) return "warning"
  return "ok"
}

export function computeIndexerHealthStatus(
  latestSuccessfulFinishedAt: Date | string | null,
  failStreakCount: number,
  now: Date,
  t: IndexerHealthConfig
): IndexerHealthSeverity {
  const staleStatus = computeIndexerStaleStatus(latestSuccessfulFinishedAt, now, t)
  const failureStatus = computeIndexerFailureAccumulationStatus(failStreakCount, t)

  if (staleStatus === "unknown") return "unknown"
  if (staleStatus === "critical" || failureStatus === "critical") return "critical"
  if (staleStatus === "warning" || failureStatus === "warning") return "warning"
  return "ok"
}

export function computeIndexerHealthSli(
  latestSuccessfulFinishedAt: Date | string | null,
  failStreakCount: number,
  now: Date,
  t: IndexerHealthConfig
): number {
  if (!latestSuccessfulFinishedAt || failStreakCount >= t.max_consecutive_failures) return 0

  const latestSuccess = latestSuccessfulFinishedAt instanceof Date ? latestSuccessfulFinishedAt : new Date(latestSuccessfulFinishedAt)
  const ageMinutes = Math.max(0, (now.getTime() - latestSuccess.getTime()) / 60000)
  if (ageMinutes >= t.critical_after_minutes) return 0

  const staleScore =
    ageMinutes <= t.warning_after_minutes
      ? 100
      : ((t.critical_after_minutes - ageMinutes) / (t.critical_after_minutes - t.warning_after_minutes)) * 100
  const failureScore = failStreakCount <= 0 ? 100 : Math.max(0, (1 - failStreakCount / t.max_consecutive_failures) * 100)

  return Math.round(Math.min(staleScore, failureScore))
}
