import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import Fastify, { FastifyInstance } from "fastify"

import cachePlugin from "../src/plugins/cache.js"
import { registerUsgSupplyRoute } from "../src/routes/usg_supply.route.js"
import { UsgSupplyService, circulatingFromBalances } from "../src/services/usg_supply.service.js"

describe("circulatingFromBalances", () => {
  it("subtracts every pegkeeper balance from the total supply", () => {
    expect(circulatingFromBalances(1000n, [100n, 250n])).toBe(650n)
  })

  it("clamps to zero when pegkeepers somehow hold more than the total supply", () => {
    expect(circulatingFromBalances(100n, [80n, 50n])).toBe(0n)
  })

  it("returns the total supply when there are no pegkeepers", () => {
    expect(circulatingFromBalances(1000n, [])).toBe(1000n)
  })
})

describe("USG supply routes", () => {
  let app: FastifyInstance

  const usgSupplyService = {
    getTotalSupply: vi.fn(async () => "1234567.89"),
    getCirculatingSupply: vi.fn(async () => "987654.321"),
  } as unknown as UsgSupplyService

  beforeAll(async () => {
    app = Fastify()
    await app.register(cachePlugin)
    await app.register(registerUsgSupplyRoute, { usgSupplyService })
    await app.ready()
  })

  beforeEach(() => {
    app.longCache.clear()
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await app.close()
  })

  // Coingecko's own /api/v3/supply/eth answers {"result":"<decimal string>"}.
  it("serves the total supply in Coingecko's result shape", async () => {
    const res = await app.inject({ method: "GET", url: "/usg/total-supply" })

    expect(res.statusCode).toBe(200)
    expect(res.headers["content-type"]).toMatch(/^application\/json/)
    expect(res.json()).toEqual({ result: "1234567.89" })
  })

  it("serves the circulating supply in Coingecko's result shape", async () => {
    const res = await app.inject({ method: "GET", url: "/usg/circulating-supply" })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ result: "987654.321" })
  })

  it("keeps the amount a string so JSON floats cannot lose precision", async () => {
    vi.mocked(usgSupplyService.getTotalSupply).mockResolvedValueOnce("122035556.786503539353518612")

    const res = await app.inject({ method: "GET", url: "/usg/total-supply" })

    expect(res.body).toContain('"122035556.786503539353518612"')
  })

  it("caches so a second request does not hit the RPC again", async () => {
    await app.inject({ method: "GET", url: "/usg/total-supply" })
    const res = await app.inject({ method: "GET", url: "/usg/total-supply" })

    expect(res.json()).toEqual({ result: "1234567.89" })
    expect(usgSupplyService.getTotalSupply).toHaveBeenCalledTimes(1)
  })

  it("returns 503 when the RPC call fails", async () => {
    vi.mocked(usgSupplyService.getCirculatingSupply).mockRejectedValueOnce(new Error("rpc down"))

    const res = await app.inject({ method: "GET", url: "/usg/circulating-supply" })

    expect(res.statusCode).toBe(503)
  })
})
