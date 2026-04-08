import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import Fastify, { FastifyInstance } from "fastify"

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
    await app.register(registerProtocolMetricsRoute, { protocolMetricsService })
    await app.ready()
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
})

describe("ProtocolMetricsService.getPriceHistoryByRange", () => {
  it("accepts a valid range and forwards normalized addresses to the repository", async () => {
    const repo = {
      getPriceHistory: vi.fn(async () => []),
    }
    const service = new ProtocolMetricsService(repo as unknown as ConstructorParameters<typeof ProtocolMetricsService>[0])
    ;(service as unknown as { getBlockchainNow: () => Promise<Date> }).getBlockchainNow = async () => new Date("2026-01-08T12:00:00.000Z")

    await service.getPriceHistoryByRange(["0x" + "A".repeat(40)], "1W")

    expect(repo.getPriceHistory).toHaveBeenCalledWith([addrA], "2026-01-01T00:00:00Z", "2026-01-08T12:00:00.000Z", 200)
  })

  it("rejects more than five token addresses", async () => {
    const service = new ProtocolMetricsService({
      getPriceHistory: vi.fn(),
    } as unknown as ConstructorParameters<typeof ProtocolMetricsService>[0])

    await expect(service.getPriceHistoryByRange([addrA, addrB, addrC, addrD, addrE, addrF], "1D")).rejects.toThrow(
      "A maximum of 5 token addresses is allowed",
    )
  })
})
