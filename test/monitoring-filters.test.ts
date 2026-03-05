import { describe, it, expect } from "vitest"
import { parseMonitoringQuery, resolveFiltersForModule } from "../src/services/monitoring/monitoring.filters.js"
import { ALL_MODULES, type MonitoringModuleName } from "../src/services/monitoring/monitoring.types.js"

const ADDR = "0x" + "a".repeat(40)
const ADDR_2 = "0x" + "b".repeat(40)

// ---------------------------------------------------------------------------
// parseMonitoringQuery
// ---------------------------------------------------------------------------
describe("parseMonitoringQuery", () => {
  describe("module selection", () => {
    it("returns all modules when modules param is absent", () => {
      const result = parseMonitoringQuery({})
      expect(result.requestedModules).toEqual([...ALL_MODULES])
      expect(result.isSingleModule).toBe(false)
    })

    it("returns all modules when modules=all", () => {
      const result = parseMonitoringQuery({ modules: "all" })
      expect(result.requestedModules).toEqual([...ALL_MODULES])
    })

    it("selects a single module", () => {
      const result = parseMonitoringQuery({ modules: "peg" })
      expect(result.requestedModules).toEqual(["peg"])
      expect(result.isSingleModule).toBe(true)
    })

    it("selects multiple modules via CSV", () => {
      const result = parseMonitoringQuery({ modules: "peg,overview,liquidations" })
      expect(result.requestedModules).toEqual(["peg", "overview", "liquidations"])
      expect(result.isSingleModule).toBe(false)
    })

    it("ignores unknown module names", () => {
      const result = parseMonitoringQuery({ modules: "peg,unknown,overview" })
      expect(result.requestedModules).toEqual(["peg", "overview"])
    })
  })

  describe("refresh flag", () => {
    it("defaults to false", () => {
      expect(parseMonitoringQuery({}).refresh).toBe(false)
    })

    it("is true when refresh=true", () => {
      expect(parseMonitoringQuery({ refresh: "true" }).refresh).toBe(true)
    })

    it("is false for any other value", () => {
      expect(parseMonitoringQuery({ refresh: "false" }).refresh).toBe(false)
      expect(parseMonitoringQuery({ refresh: "1" }).refresh).toBe(false)
    })
  })

  describe("global filters", () => {
    it("extracts known global keys", () => {
      const result = parseMonitoringQuery({
        market_address: ADDR,
        borrower_address: "0xabc",
        status: "warning",
        offset: "10",
        limit: "20",
        asset: "USDC",
      })
      expect(result.globalFilters).toEqual({
        market_address: ADDR,
        borrower_address: "0xabc",
        status: "warning",
        offset: "10",
        limit: "20",
        asset: "USDC",
      })
    })

    it("ignores unknown flat keys", () => {
      const result = parseMonitoringQuery({ foo: "bar", market_address: ADDR })
      expect(result.globalFilters).toEqual({ market_address: ADDR })
    })

    it("does not include modules or refresh in globalFilters", () => {
      const result = parseMonitoringQuery({ modules: "peg", refresh: "true", market_address: ADDR })
      expect(result.globalFilters).toEqual({ market_address: ADDR })
    })
  })

  describe("per-module overrides (dot notation)", () => {
    it("parses collateralization.status override", () => {
      const result = parseMonitoringQuery({ "collateralization.status": "danger" })
      expect(result.perModuleOverrides).toEqual({
        collateralization: { status: "danger" },
      })
    })

    it("parses multiple overrides for different modules", () => {
      const result = parseMonitoringQuery({
        "collateralization.status": "danger",
        "peg.asset": "USDT",
        "liquidations.period": "7d",
      })
      expect(result.perModuleOverrides).toEqual({
        collateralization: { status: "danger" },
        peg: { asset: "USDT" },
        liquidations: { period: "7d" },
      })
    })

    it("parses multiple overrides for the same module", () => {
      const result = parseMonitoringQuery({
        "collateralization.status": "danger",
        "collateralization.sort_by": "cr",
      })
      expect(result.perModuleOverrides.collateralization).toEqual({
        status: "danger",
        sort_by: "cr",
      })
    })

    it("combines global filters and per-module overrides", () => {
      const result = parseMonitoringQuery({
        market_address: ADDR,
        status: "warning",
        "collateralization.status": "danger",
      })
      expect(result.globalFilters).toEqual({ market_address: ADDR, status: "warning" })
      expect(result.perModuleOverrides).toEqual({
        collateralization: { status: "danger" },
      })
    })
  })
})

// ---------------------------------------------------------------------------
// resolveFiltersForModule
// ---------------------------------------------------------------------------
describe("resolveFiltersForModule", () => {
  function makeParsed(overrides: Partial<ReturnType<typeof parseMonitoringQuery>> = {}) {
    return {
      requestedModules: [...ALL_MODULES] as MonitoringModuleName[],
      isSingleModule: false,
      refresh: false,
      globalFilters: {},
      perModuleOverrides: {},
      ...overrides,
    }
  }

  describe("default filters", () => {
    it("returns default offset=0 and limit=10 for multi-module request", () => {
      const filters = resolveFiltersForModule("collateralization", makeParsed())
      expect(filters.offset).toBe(0)
      expect(filters.limit).toBe(10)
    })

    it("returns default limit=50 for single-module request", () => {
      const filters = resolveFiltersForModule(
        "collateralization",
        makeParsed({ isSingleModule: true }),
      )
      expect(filters.offset).toBe(0)
      expect(filters.limit).toBe(50)
    })

    it("has no market_address, borrower_address, or status by default", () => {
      const filters = resolveFiltersForModule("collateralization", makeParsed())
      expect(filters.market_address).toBeUndefined()
      expect(filters.borrower_address).toBeUndefined()
      expect(filters.status).toBeUndefined()
    })
  })

  describe("global filters applied per module config", () => {
    it("applies market_address to collateralization (which accepts it)", () => {
      const filters = resolveFiltersForModule(
        "collateralization",
        makeParsed({ globalFilters: { market_address: ADDR } }),
      )
      expect(filters.market_address).toBe(ADDR)
    })

    it("applies borrower_address to collateralization", () => {
      const filters = resolveFiltersForModule(
        "collateralization",
        makeParsed({ globalFilters: { borrower_address: "0xabc" } }),
      )
      expect(filters.borrower_address).toBe("0xabc")
    })

    it("applies status to collateralization", () => {
      const filters = resolveFiltersForModule(
        "collateralization",
        makeParsed({ globalFilters: { status: "warning" } }),
      )
      expect(filters.status).toBe("warning")
    })

    it("does NOT apply borrower_address to peg (not in its filter list)", () => {
      const filters = resolveFiltersForModule(
        "peg",
        makeParsed({ globalFilters: { borrower_address: "0xabc" } }),
      )
      expect(filters.borrower_address).toBeUndefined()
    })

    it("does NOT apply status to debt_utilization (not in its filter list)", () => {
      const filters = resolveFiltersForModule(
        "debt_utilization",
        makeParsed({ globalFilters: { status: "warning" } }),
      )
      expect(filters.status).toBeUndefined()
    })

    it("does NOT apply market_address to overview (no filters)", () => {
      const filters = resolveFiltersForModule(
        "overview",
        makeParsed({ globalFilters: { market_address: ADDR } }),
      )
      expect(filters.market_address).toBeUndefined()
    })

    it("applies asset to peg (which accepts it)", () => {
      const filters = resolveFiltersForModule(
        "peg",
        makeParsed({ globalFilters: { asset: "USDC" } }),
      )
      expect(filters.asset).toBe("USDC")
    })

    it("does NOT apply asset to collateralization (not in its filter list)", () => {
      const filters = resolveFiltersForModule(
        "collateralization",
        makeParsed({ globalFilters: { asset: "USDC" } }),
      )
      expect(filters.asset).toBeUndefined()
    })
  })

  describe("pagination on paginated vs non-paginated modules", () => {
    it("applies global offset/limit to paginated module (collateralization)", () => {
      const filters = resolveFiltersForModule(
        "collateralization",
        makeParsed({ globalFilters: { offset: "20", limit: "5" } }),
      )
      expect(filters.offset).toBe(20)
      expect(filters.limit).toBe(5)
    })

    it("applies global offset/limit to paginated module (liquidations)", () => {
      const filters = resolveFiltersForModule(
        "liquidations",
        makeParsed({ globalFilters: { offset: "10", limit: "25" } }),
      )
      expect(filters.offset).toBe(10)
      expect(filters.limit).toBe(25)
    })

    it("does NOT apply global offset/limit to non-paginated module (peg)", () => {
      const filters = resolveFiltersForModule(
        "peg",
        makeParsed({ globalFilters: { offset: "20", limit: "5" } }),
      )
      // non-paginated: keeps defaults
      expect(filters.offset).toBe(0)
      expect(filters.limit).toBe(10)
    })

    it("does NOT apply global offset/limit to non-paginated module (overview)", () => {
      const filters = resolveFiltersForModule(
        "overview",
        makeParsed({ globalFilters: { offset: "20", limit: "5" } }),
      )
      expect(filters.offset).toBe(0)
      expect(filters.limit).toBe(10)
    })
  })

  describe("per-module overrides take priority", () => {
    it("per-module status overrides global status", () => {
      const filters = resolveFiltersForModule(
        "collateralization",
        makeParsed({
          globalFilters: { status: "warning" },
          perModuleOverrides: { collateralization: { status: "danger" } },
        }),
      )
      expect(filters.status).toBe("danger")
    })

    it("per-module market_address overrides global market_address", () => {
      const filters = resolveFiltersForModule(
        "collateralization",
        makeParsed({
          globalFilters: { market_address: ADDR },
          perModuleOverrides: { collateralization: { market_address: ADDR_2 } },
        }),
      )
      expect(filters.market_address).toBe(ADDR_2)
    })

    it("per-module offset/limit overrides global and defaults", () => {
      const filters = resolveFiltersForModule(
        "collateralization",
        makeParsed({
          globalFilters: { offset: "20", limit: "5" },
          perModuleOverrides: { collateralization: { offset: "100", limit: "3" } },
        }),
      )
      expect(filters.offset).toBe(100)
      expect(filters.limit).toBe(3)
    })

    it("per-module override does not affect other modules", () => {
      const parsed = makeParsed({
        perModuleOverrides: { collateralization: { status: "danger" } },
      })
      const collatFilters = resolveFiltersForModule("collateralization", parsed)
      const liqDistFilters = resolveFiltersForModule("liquidation_distance", parsed)
      expect(collatFilters.status).toBe("danger")
      expect(liqDistFilters.status).toBeUndefined()
    })

    it("per-module override can set sort_by on collateralization", () => {
      const filters = resolveFiltersForModule(
        "collateralization",
        makeParsed({
          perModuleOverrides: { collateralization: { sort_by: "margin" } },
        }),
      )
      expect(filters.sort_by).toBe("margin")
    })

    it("per-module override can set period on liquidations", () => {
      const filters = resolveFiltersForModule(
        "liquidations",
        makeParsed({
          perModuleOverrides: { liquidations: { period: "7d" } },
        }),
      )
      expect(filters.period).toBe("7d")
    })
  })

  describe("combined scenario: defaults + globals + overrides", () => {
    it("full scenario with all three layers", () => {
      const parsed = makeParsed({
        isSingleModule: false,
        globalFilters: { market_address: ADDR, status: "warning", offset: "10", limit: "20" },
        perModuleOverrides: {
          collateralization: { status: "critical", sort_by: "cr" },
        },
      })

      // collateralization: global market_address applied, status overridden to critical
      const collat = resolveFiltersForModule("collateralization", parsed)
      expect(collat.market_address).toBe(ADDR)
      expect(collat.status).toBe("critical")
      expect(collat.sort_by).toBe("cr")
      expect(collat.offset).toBe(10)
      expect(collat.limit).toBe(20)

      // liquidation_distance: global market_address + status applied, no override
      const liqDist = resolveFiltersForModule("liquidation_distance", parsed)
      expect(liqDist.market_address).toBe(ADDR)
      expect(liqDist.status).toBe("warning")
      expect(liqDist.offset).toBe(10)
      expect(liqDist.limit).toBe(20)

      // peg: no market_address (not in filter list), status applied, non-paginated
      const peg = resolveFiltersForModule("peg", parsed)
      expect(peg.market_address).toBeUndefined()
      expect(peg.status).toBe("warning")
      expect(peg.offset).toBe(0) // non-paginated, defaults
      expect(peg.limit).toBe(10)

      // overview: no filters accepted
      const overview = resolveFiltersForModule("overview", parsed)
      expect(overview.market_address).toBeUndefined()
      expect(overview.status).toBeUndefined()
      expect(overview.offset).toBe(0)
      expect(overview.limit).toBe(10)

      // debt_utilization: market_address applied, no status (not in filter list), non-paginated
      const debt = resolveFiltersForModule("debt_utilization", parsed)
      expect(debt.market_address).toBe(ADDR)
      expect(debt.status).toBeUndefined()
      expect(debt.offset).toBe(0)
      expect(debt.limit).toBe(10)
    })
  })

  describe("type handling", () => {
    it("keeps market_address as string", () => {
      const filters = resolveFiltersForModule(
        "collateralization",
        makeParsed({ globalFilters: { market_address: ADDR } }),
      )
      expect(filters.market_address).toBe(ADDR)
      expect(typeof filters.market_address).toBe("string")
    })

    it("coerces offset and limit to number", () => {
      const filters = resolveFiltersForModule(
        "collateralization",
        makeParsed({ globalFilters: { offset: "5", limit: "15" } }),
      )
      expect(typeof filters.offset).toBe("number")
      expect(typeof filters.limit).toBe("number")
    })

    it("keeps market_address from per-module override as string", () => {
      const filters = resolveFiltersForModule(
        "collateralization",
        makeParsed({
          perModuleOverrides: { collateralization: { market_address: ADDR_2 } },
        }),
      )
      expect(filters.market_address).toBe(ADDR_2)
      expect(typeof filters.market_address).toBe("string")
    })
  })
})
