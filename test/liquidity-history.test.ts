import { describe, expect, it, vi } from "vitest"

import { ProtocolMetricsRepository } from "../src/data/protocol_metrics.data.js"
import { ProtocolMetricsService } from "../src/services/protocol_metrics.service.js"

describe("getLiquidityHistory", () => {
  it("groups rows per LP and sums each LP's latest value into total", async () => {
    const d = (day: number) => new Date(Date.UTC(2026, 0, day))
    const repo = {
      getLiquidityHistory: vi.fn(async () => [
        { lpName: "A", lpAddress: "0xa", date: d(1), liquidityUsd: 10 },
        { lpName: "A", lpAddress: "0xa", date: d(2), liquidityUsd: 15 },
        { lpName: "B", lpAddress: "0xb", date: d(1), liquidityUsd: 5 },
      ]),
    } as unknown as ProtocolMetricsRepository

    const result = await new ProtocolMetricsService(repo).getLiquidityHistory("1w")

    expect(result.total).toBe(20)
    expect(result.lps.map((lp) => [lp.lpName, lp.history.length])).toEqual([
      ["A", 2],
      ["B", 1],
    ])
    expect(repo.getLiquidityHistory).toHaveBeenCalledWith(expect.any(String), expect.any(String), 200)
  })

  it("passes a null lower bound for all", async () => {
    const repo = { getLiquidityHistory: vi.fn(async () => []) } as unknown as ProtocolMetricsRepository

    expect(await new ProtocolMetricsService(repo).getLiquidityHistory("all")).toEqual({ total: 0, lps: [] })
    expect(repo.getLiquidityHistory).toHaveBeenCalledWith(null, expect.any(String), 200)
  })
})
