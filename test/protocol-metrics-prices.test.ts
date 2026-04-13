import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import Fastify, { FastifyInstance } from "fastify"

import cachePlugin from "../src/plugins/cache.js"
import { registerProtocolMetricsRoute } from "../src/routes/protocol_metrics.route.js"
import { ProtocolMetricsService } from "../src/services/protocol_metrics.service.js"

const addrA = "0x" + "a".repeat(40)
const addrB = "0x" + "b".repeat(40)
const addrC = "0x" + "c".repeat(40)
const addrD = "0x" + "d".repeat(40)
const addrE = "0x" + "e".repeat(40)
const addrF = "0x" + "f".repeat(40)

describe("protocol metrics price routes", () => {
  let app: FastifyInstance

  const protocolMetricsService = {
    getLatestPrices: vi.fn(async (addresses: string[]) => addresses.map((tokenAddress) => ({ tokenAddress, priceUSD: "1.0000" }))),
    getPriceSources: vi.fn(async () => [{ tokenAddress: addrA, name: "USG" }]),
    getPriceHistoryByRange: vi.fn(async (addresses: string[], _range: string) =>
      addresses.map((tokenAddress) => ({
        tokenAddress,
        history: [{ timestamp: "2026-01-01T00:00:00.000Z", amount: "1.0000" }],
      })),
    ),
    getTotalValueLocked: vi.fn(),
    getTotalSupply: vi.fn(),
    getLastMarketAprs: vi.fn(),
    getSavingAccountsApy: vi.fn(),
    getSUSGApy: vi.fn(),
    getEventsByAccount: vi.fn(),
    transformEvents: vi.fn(),
    getMarketHistoricalData: vi.fn(),
    getOraclePriceBuckets: vi.fn(),
  } as unknown as ProtocolMetricsService

  beforeAll(async () => {
    app = Fastify()
    await app.register(cachePlugin)
    await app.register(registerProtocolMetricsRoute, { protocolMetricsService })
    await app.ready()
  })

  beforeEach(() => {
    app.longCache.clear()
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await app.close()
  })

  it("accepts multiple token addresses on /prices and forwards them as CSV parts", async () => {
    const res = await app.inject({ method: "GET", url: `/prices/${addrA},${addrB}` })

    expect(res.statusCode).toBe(200)
    expect(protocolMetricsService.getLatestPrices).toHaveBeenCalledWith([addrA, addrB])
  })

  it("rejects invalid token CSV on /prices", async () => {
    const res = await app.inject({ method: "GET", url: `/prices/${addrA},invalid-address` })

    expect(res.statusCode).toBe(400)
  })

  it("returns price sources", async () => {
    const res = await app.inject({ method: "GET", url: "/price-sources" })

    expect(res.statusCode).toBe(200)
    expect(protocolMetricsService.getPriceSources).toHaveBeenCalled()
  })

  it("caches identical price source requests", async () => {
    protocolMetricsService.getPriceSources.mockClear()

    const first = await app.inject({ method: "GET", url: "/price-sources" })
    const second = await app.inject({ method: "GET", url: "/price-sources" })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(protocolMetricsService.getPriceSources).toHaveBeenCalledTimes(1)
  })

  it("accepts lowercase ranges on /price-history", async () => {
    const res = await app.inject({ method: "GET", url: `/price-history/${addrA}?range=1w` })

    expect(res.statusCode).toBe(200)
    expect(protocolMetricsService.getPriceHistoryByRange).toHaveBeenCalledWith([addrA], "1w")
  })

  it("rejects uppercase ranges on /price-history", async () => {
    const res = await app.inject({ method: "GET", url: `/price-history/${addrA}?range=1W` })

    expect(res.statusCode).toBe(400)
  })

  it("caches identical price history requests", async () => {
    protocolMetricsService.getPriceHistoryByRange.mockClear()

    const first = await app.inject({ method: "GET", url: `/price-history/${addrA}?range=1w` })
    const second = await app.inject({ method: "GET", url: `/price-history/${addrA}?range=1w` })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(protocolMetricsService.getPriceHistoryByRange).toHaveBeenCalledTimes(1)
  })
})

describe("ProtocolMetricsService.getPriceHistoryByRange", () => {
  it("accepts a valid range and forwards normalized addresses to the repository", async () => {
    const repo = {
      getPriceHistory: vi.fn(async () => []),
    }
    const service = new ProtocolMetricsService(repo as unknown as ConstructorParameters<typeof ProtocolMetricsService>[0])
    ;(service as unknown as { getBlockchainNow: () => Promise<Date> }).getBlockchainNow = async () => new Date("2026-01-08T12:00:00.000Z")

    await service.getPriceHistoryByRange(["0x" + "A".repeat(40)], "1w")

    expect(repo.getPriceHistory).toHaveBeenCalledWith([addrA], "2026-01-01T00:00:00Z", "2026-01-08T12:00:00.000Z", 200)
  })

  it("rejects more than five token addresses", async () => {
    const service = new ProtocolMetricsService({
      getPriceHistory: vi.fn(),
    } as unknown as ConstructorParameters<typeof ProtocolMetricsService>[0])

    await expect(service.getPriceHistoryByRange([addrA, addrB, addrC, addrD, addrE, addrF], "1d")).rejects.toThrow(
      "A maximum of 5 token addresses is allowed",
    )
  })
})
