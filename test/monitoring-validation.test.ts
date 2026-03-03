import { describe, it, expect, beforeAll, afterAll } from "vitest"
import Fastify, { FastifyInstance } from "fastify"
import { monitoringSchema } from "../src/schemas/monitoring.schema.js"

/**
 * Lightweight Fastify instance that registers only the querystring
 * schema on a stub route. No DB, no cache, no response validation.
 */
let app: FastifyInstance

beforeAll(async () => {
  app = Fastify()
  app.get(
    "/monitoring",
    { schema: { querystring: monitoringSchema.schema!.querystring } },
    async () => ({ ok: true }),
  )
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

function inject(query: Record<string, string>) {
  const qs = new URLSearchParams(query).toString()
  return app.inject({ method: "GET", url: `/monitoring${qs ? `?${qs}` : ""}` })
}

// ---------------------------------------------------------------------------
// modules
// ---------------------------------------------------------------------------
describe("modules validation", () => {
  it("accepts modules=all", async () => {
    const res = await inject({ modules: "all" })
    expect(res.statusCode).toBe(200)
  })

  it("accepts a single valid module", async () => {
    const res = await inject({ modules: "peg" })
    expect(res.statusCode).toBe(200)
  })

  it("accepts multiple valid modules (CSV)", async () => {
    const res = await inject({ modules: "peg,overview,liquidations" })
    expect(res.statusCode).toBe(200)
  })

  it("rejects an unknown module name", async () => {
    const res = await inject({ modules: "unknown" })
    expect(res.statusCode).toBe(400)
  })

  it("rejects a mix with an unknown module", async () => {
    const res = await inject({ modules: "peg,unknown" })
    expect(res.statusCode).toBe(400)
  })

  it("rejects trailing comma", async () => {
    const res = await inject({ modules: "peg," })
    expect(res.statusCode).toBe(400)
  })

  it("rejects leading comma", async () => {
    const res = await inject({ modules: ",peg" })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// market_address
// ---------------------------------------------------------------------------
describe("market_address validation", () => {
  it("accepts a valid 0x address (40 hex chars)", async () => {
    const res = await inject({ market_address: "0x" + "a".repeat(40) })
    expect(res.statusCode).toBe(200)
  })

  it("rejects missing 0x prefix", async () => {
    const res = await inject({ market_address: "a".repeat(40) })
    expect(res.statusCode).toBe(400)
  })

  it("rejects too short address", async () => {
    const res = await inject({ market_address: "0x" + "a".repeat(39) })
    expect(res.statusCode).toBe(400)
  })

  it("rejects too long address", async () => {
    const res = await inject({ market_address: "0x" + "a".repeat(41) })
    expect(res.statusCode).toBe(400)
  })

  it("rejects non-hex characters", async () => {
    const res = await inject({ market_address: "0x" + "g".repeat(40) })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// borrower_address
// ---------------------------------------------------------------------------
describe("borrower_address validation", () => {
  it("accepts a valid 0x address (40 hex chars)", async () => {
    const res = await inject({ borrower_address: "0x" + "a".repeat(40) })
    expect(res.statusCode).toBe(200)
  })

  it("rejects missing 0x prefix", async () => {
    const res = await inject({ borrower_address: "a".repeat(40) })
    expect(res.statusCode).toBe(400)
  })

  it("rejects too short address", async () => {
    const res = await inject({ borrower_address: "0x" + "a".repeat(39) })
    expect(res.statusCode).toBe(400)
  })

  it("rejects too long address", async () => {
    const res = await inject({ borrower_address: "0x" + "a".repeat(41) })
    expect(res.statusCode).toBe(400)
  })

  it("rejects non-hex characters", async () => {
    const res = await inject({ borrower_address: "0x" + "g".repeat(40) })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------
describe("status validation", () => {
  const validStatuses = ["safe", "warning", "danger", "critical", "pegged", "drift", "ok", "watch"]

  for (const s of validStatuses) {
    it(`accepts '${s}'`, async () => {
      const res = await inject({ status: s })
      expect(res.statusCode).toBe(200)
    })
  }

  it("rejects an unknown status", async () => {
    const res = await inject({ status: "unknown" })
    expect(res.statusCode).toBe(400)
  })

  it("rejects empty string", async () => {
    const res = await inject({ status: "" })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// asset
// ---------------------------------------------------------------------------
describe("asset validation", () => {
  it("accepts a valid asset name", async () => {
    const res = await inject({ asset: "USDC" })
    expect(res.statusCode).toBe(200)
  })

  it("rejects a string longer than 20 chars", async () => {
    const res = await inject({ asset: "A".repeat(21) })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// offset
// ---------------------------------------------------------------------------
describe("offset validation", () => {
  it("accepts 0", async () => {
    const res = await inject({ offset: "0" })
    expect(res.statusCode).toBe(200)
  })

  it("accepts a positive integer", async () => {
    const res = await inject({ offset: "100" })
    expect(res.statusCode).toBe(200)
  })

  it("rejects negative value", async () => {
    const res = await inject({ offset: "-1" })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// limit
// ---------------------------------------------------------------------------
describe("limit validation", () => {
  it("accepts 1 (minimum)", async () => {
    const res = await inject({ limit: "1" })
    expect(res.statusCode).toBe(200)
  })

  it("accepts 200 (maximum)", async () => {
    const res = await inject({ limit: "200" })
    expect(res.statusCode).toBe(200)
  })

  it("rejects 0", async () => {
    const res = await inject({ limit: "0" })
    expect(res.statusCode).toBe(400)
  })

  it("rejects value above 200", async () => {
    const res = await inject({ limit: "201" })
    expect(res.statusCode).toBe(400)
  })

  it("rejects negative value", async () => {
    const res = await inject({ limit: "-5" })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// refresh
// ---------------------------------------------------------------------------
describe("refresh validation", () => {
  it("accepts 'true'", async () => {
    const res = await inject({ refresh: "true" })
    expect(res.statusCode).toBe(200)
  })

  it("accepts 'false'", async () => {
    const res = await inject({ refresh: "false" })
    expect(res.statusCode).toBe(200)
  })

  it("rejects any other value", async () => {
    const res = await inject({ refresh: "yes" })
    expect(res.statusCode).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// dot-notation overrides (additionalProperties: true)
// ---------------------------------------------------------------------------
describe("dot-notation overrides pass through", () => {
  it("allows collateralization.status as additional property", async () => {
    const res = await inject({ "collateralization.status": "danger" })
    expect(res.statusCode).toBe(200)
  })

  it("allows peg.asset as additional property", async () => {
    const res = await inject({ "peg.asset": "USDT" })
    expect(res.statusCode).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// combined valid request
// ---------------------------------------------------------------------------
describe("combined valid request", () => {
  it("accepts a full valid query", async () => {
    const res = await inject({
      modules: "collateralization,peg",
      market_address: "0x" + "aB".repeat(20),
      borrower_address: "0x" + "aB".repeat(20),
      status: "warning",
      asset: "USDC",
      offset: "10",
      limit: "50",
      refresh: "true",
    })
    expect(res.statusCode).toBe(200)
  })

  it("accepts an empty query (all defaults)", async () => {
    const res = await inject({})
    expect(res.statusCode).toBe(200)
  })
})
