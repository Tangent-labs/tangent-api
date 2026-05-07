import { describe, it, expect } from "vitest"
import {
  computeCollateralizationStatus,
  computeLiquidationDistanceStatus,
  computePegStatus,
  computePriceVariationStatus,
  computeOracleSanityStatus,
  computeDebtUtilizationStatus,
  computeTvlVariationStatus,
  computeIndexerStaleStatus,
  computeIndexerFailureAccumulationStatus,
  computeIndexerHealthStatus,
  computeIndexerHealthSli,
} from "../src/services/monitoring/monitoring.status.js"

// ---------------------------------------------------------------------------
// computeCollateralizationStatus
// ---------------------------------------------------------------------------
describe("computeCollateralizationStatus", () => {
  const t = { warning_multiplier: 1.1, danger_multiplier: 1.03, critical_multiplier: 1.0 }
  const lt = 0.8 // liquidation_threshold

  it("returns safe when cr >= lt * warning_multiplier", () => {
    expect(computeCollateralizationStatus(lt * 1.1, lt, t)).toBe("safe")
    expect(computeCollateralizationStatus(lt * 1.5, lt, t)).toBe("safe")
  })

  it("returns warning when cr is between danger and warning thresholds", () => {
    expect(computeCollateralizationStatus(lt * 1.05, lt, t)).toBe("warning")
  })

  it("returns danger when cr is between critical and danger thresholds", () => {
    expect(computeCollateralizationStatus(lt * 1.01, lt, t)).toBe("danger")
  })

  it("returns critical when cr < lt * critical_multiplier", () => {
    expect(computeCollateralizationStatus(lt * 0.99, lt, t)).toBe("critical")
  })

  it("returns safe at exact boundary", () => {
    expect(computeCollateralizationStatus(lt * t.warning_multiplier, lt, t)).toBe("safe")
  })
})

// ---------------------------------------------------------------------------
// computeLiquidationDistanceStatus
// ---------------------------------------------------------------------------
describe("computeLiquidationDistanceStatus", () => {
  const t = { safe_pct: 5.0, warning_pct: 2.0, danger_pct: 1.0, critical_pct: 0.5 }

  it("returns safe when distance >= safe_pct", () => {
    expect(computeLiquidationDistanceStatus(5.0, t)).toBe("safe")
    expect(computeLiquidationDistanceStatus(10.0, t)).toBe("safe")
  })

  it("returns warning when between warning and safe", () => {
    expect(computeLiquidationDistanceStatus(3.0, t)).toBe("warning")
  })

  it("returns danger when between danger and warning", () => {
    expect(computeLiquidationDistanceStatus(1.5, t)).toBe("danger")
  })

  it("returns critical when below danger_pct", () => {
    expect(computeLiquidationDistanceStatus(0.5, t)).toBe("critical")
    expect(computeLiquidationDistanceStatus(0.0, t)).toBe("critical")
  })
})

// ---------------------------------------------------------------------------
// computePegStatus
// ---------------------------------------------------------------------------
describe("computePegStatus", () => {
  const t = { safe_pct: 0.5, warning_pct: 2.0, danger_pct: 5.0 }

  it("returns pegged when deviation is small", () => {
    expect(computePegStatus(0.1, t)).toBe("pegged")
    expect(computePegStatus(-0.3, t)).toBe("pegged")
  })

  it("returns drift when between safe and warning", () => {
    expect(computePegStatus(1.0, t)).toBe("drift")
    expect(computePegStatus(-1.5, t)).toBe("drift")
  })

  it("returns danger when between warning and danger", () => {
    expect(computePegStatus(3.0, t)).toBe("danger")
    expect(computePegStatus(-4.0, t)).toBe("danger")
  })

  it("returns critical when beyond danger", () => {
    expect(computePegStatus(5.0, t)).toBe("critical")
    expect(computePegStatus(-10.0, t)).toBe("critical")
  })

  it("uses absolute value for negative deviations", () => {
    expect(computePegStatus(-0.1, t)).toBe("pegged")
    expect(computePegStatus(-6.0, t)).toBe("critical")
  })
})

// ---------------------------------------------------------------------------
// computePriceVariationStatus
// ---------------------------------------------------------------------------
describe("computePriceVariationStatus", () => {
  const t = {
    stable: { "5m": 0.3, "15m": 0.5, "1h": 1.0, "4h": 2.0 },
    volatile: { "5m": 2.0, "15m": 5.0, "1h": 10.0, "4h": 15.0 },
  }

  it("returns ok when all deltas are below thresholds", () => {
    expect(computePriceVariationStatus({ delta_5m: 0.1, delta_15m: 0.2, delta_1h: 0.5, delta_4h: 1.0 }, "stable", t)).toBe("ok")
  })

  it("returns watch when max ratio >= 1", () => {
    expect(computePriceVariationStatus({ delta_5m: 0.3, delta_15m: 0.0, delta_1h: 0.0, delta_4h: 0.0 }, "stable", t)).toBe("watch")
  })

  it("returns danger when max ratio >= 2", () => {
    expect(computePriceVariationStatus({ delta_5m: 0.6, delta_15m: 0.0, delta_1h: 0.0, delta_4h: 0.0 }, "stable", t)).toBe("danger")
  })

  it("returns critical when max ratio >= 3", () => {
    expect(computePriceVariationStatus({ delta_5m: 0.9, delta_15m: 0.0, delta_1h: 0.0, delta_4h: 0.0 }, "stable", t)).toBe("critical")
  })

  it("uses absolute values for negative deltas", () => {
    expect(computePriceVariationStatus({ delta_5m: -0.9, delta_15m: 0.0, delta_1h: 0.0, delta_4h: 0.0 }, "stable", t)).toBe("critical")
  })

  it("works with volatile thresholds", () => {
    expect(computePriceVariationStatus({ delta_5m: 1.0, delta_15m: 0.0, delta_1h: 0.0, delta_4h: 0.0 }, "volatile", t)).toBe("ok")
    expect(computePriceVariationStatus({ delta_5m: 6.0, delta_15m: 0.0, delta_1h: 0.0, delta_4h: 0.0 }, "volatile", t)).toBe("critical")
  })
})

// ---------------------------------------------------------------------------
// computeOracleSanityStatus
// ---------------------------------------------------------------------------
describe("computeOracleSanityStatus", () => {
  const t = { deviation_warning_pct: 1.0, deviation_danger_pct: 3.0, max_age_warning_seconds: 300, max_age_danger_seconds: 600 }

  it("returns ok when both deviation and age are ok", () => {
    expect(computeOracleSanityStatus(0.5, 100, t)).toBe("ok")
  })

  it("returns watch when deviation is in warning range", () => {
    expect(computeOracleSanityStatus(2.0, 100, t)).toBe("watch")
  })

  it("returns watch when age is in warning range", () => {
    expect(computeOracleSanityStatus(0.5, 400, t)).toBe("watch")
  })

  it("returns danger when deviation exceeds danger threshold", () => {
    expect(computeOracleSanityStatus(4.0, 100, t)).toBe("danger")
  })

  it("returns danger when age exceeds danger threshold", () => {
    expect(computeOracleSanityStatus(0.5, 700, t)).toBe("danger")
  })

  it("returns the worst of the two statuses", () => {
    expect(computeOracleSanityStatus(2.0, 700, t)).toBe("danger")
    expect(computeOracleSanityStatus(4.0, 400, t)).toBe("danger")
  })

  it("returns critical when both deviation and age are danger", () => {
    expect(computeOracleSanityStatus(4.0, 700, t)).toBe("critical")
  })

  it("uses absolute value for negative deviations", () => {
    expect(computeOracleSanityStatus(-4.0, 700, t)).toBe("critical")
  })
})

// ---------------------------------------------------------------------------
// computeDebtUtilizationStatus
// ---------------------------------------------------------------------------
describe("computeDebtUtilizationStatus", () => {
  const t = { warning_pct: 85.0, danger_pct: 95.0 }

  it("returns ok when utilization is below warning", () => {
    expect(computeDebtUtilizationStatus(50.0, t)).toBe("ok")
    expect(computeDebtUtilizationStatus(84.9, t)).toBe("ok")
  })

  it("returns warning when between warning and danger", () => {
    expect(computeDebtUtilizationStatus(85.0, t)).toBe("warning")
    expect(computeDebtUtilizationStatus(90.0, t)).toBe("warning")
  })

  it("returns danger when at or above danger", () => {
    expect(computeDebtUtilizationStatus(95.0, t)).toBe("danger")
    expect(computeDebtUtilizationStatus(100.0, t)).toBe("danger")
  })
})

// ---------------------------------------------------------------------------
// computeTvlVariationStatus
// ---------------------------------------------------------------------------
describe("computeTvlVariationStatus", () => {
  const t = { warning_1h_pct: -10.0, danger_1h_pct: -15.0, warning_24h_pct: -20.0, danger_24h_pct: -30.0 }

  it("returns ok when deltas are small", () => {
    expect(computeTvlVariationStatus(-5.0, -10.0, t)).toBe("ok")
  })

  it("returns warning when 1h delta exceeds warning threshold", () => {
    expect(computeTvlVariationStatus(-12.0, -5.0, t)).toBe("warning")
  })

  it("returns warning when 24h delta exceeds warning threshold", () => {
    expect(computeTvlVariationStatus(-5.0, -25.0, t)).toBe("warning")
  })

  it("returns danger when 1h delta exceeds danger threshold", () => {
    expect(computeTvlVariationStatus(-16.0, -5.0, t)).toBe("danger")
  })

  it("returns danger when 24h delta exceeds danger threshold", () => {
    expect(computeTvlVariationStatus(-5.0, -35.0, t)).toBe("danger")
  })

  it("works correctly regardless of threshold sign configuration", () => {
    // Even if thresholds were configured as positive values, Math.abs ensures correctness
    const tPositive = { warning_1h_pct: 10.0, danger_1h_pct: 15.0, warning_24h_pct: 20.0, danger_24h_pct: 30.0 }
    expect(computeTvlVariationStatus(-16.0, -5.0, tPositive)).toBe("danger")
    expect(computeTvlVariationStatus(-12.0, -5.0, tPositive)).toBe("warning")
    expect(computeTvlVariationStatus(-5.0, -5.0, tPositive)).toBe("ok")
  })
})

// ---------------------------------------------------------------------------
// indexer health helpers
// ---------------------------------------------------------------------------
describe("indexer health helpers", () => {
  const now = new Date("2026-05-07T12:00:00.000Z")
  const t = {
    enabled: true,
    warning_after_minutes: 15,
    critical_after_minutes: 60,
    max_consecutive_failures: 3,
  }

  it("classifies stale status at freshness boundaries", () => {
    expect(computeIndexerStaleStatus(new Date("2026-05-07T11:50:00.000Z"), now, t)).toBe("ok")
    expect(computeIndexerStaleStatus(new Date("2026-05-07T11:45:00.000Z"), now, t)).toBe("warning")
    expect(computeIndexerStaleStatus(new Date("2026-05-07T11:00:00.000Z"), now, t)).toBe("critical")
  })

  it("returns unknown stale status when no successful execution exists", () => {
    expect(computeIndexerStaleStatus(null, now, t)).toBe("unknown")
    expect(computeIndexerHealthStatus(null, 0, now, t)).toBe("unknown")
  })

  it("classifies failure accumulation status", () => {
    expect(computeIndexerFailureAccumulationStatus(0, t)).toBe("ok")
    expect(computeIndexerFailureAccumulationStatus(1, t)).toBe("warning")
    expect(computeIndexerFailureAccumulationStatus(3, t)).toBe("critical")
  })

  it("returns the worst indexer health status", () => {
    expect(computeIndexerHealthStatus(new Date("2026-05-07T11:50:00.000Z"), 0, now, t)).toBe("ok")
    expect(computeIndexerHealthStatus(new Date("2026-05-07T11:50:00.000Z"), 1, now, t)).toBe("warning")
    expect(computeIndexerHealthStatus(new Date("2026-05-07T11:00:00.000Z"), 0, now, t)).toBe("critical")
  })

  it("computes SLI as 0..100 with stale and failure degradation", () => {
    expect(computeIndexerHealthSli(new Date("2026-05-07T11:50:00.000Z"), 0, now, t)).toBe(100)
    expect(computeIndexerHealthSli(new Date("2026-05-07T11:30:00.000Z"), 0, now, t)).toBe(67)
    expect(computeIndexerHealthSli(new Date("2026-05-07T11:50:00.000Z"), 1, now, t)).toBe(67)
    expect(computeIndexerHealthSli(new Date("2026-05-07T11:00:00.000Z"), 0, now, t)).toBe(0)
    expect(computeIndexerHealthSli(new Date("2026-05-07T11:50:00.000Z"), 3, now, t)).toBe(0)
    expect(computeIndexerHealthSli(null, 0, now, t)).toBe(0)
  })
})
