import { describe, expect, it } from "vitest"

function computeWindow(dateEnd: string | undefined, bucketCount: number, bucketSizeMinutes: number) {
  const rawEndDate = dateEnd ? new Date(dateEnd) : new Date()

  if (Number.isNaN(rawEndDate.getTime())) {
    throw new Error("Invalid oracle graph end date")
  }

  const endDate = rawEndDate
  const startDate = new Date(endDate.getTime() - bucketCount * bucketSizeMinutes * 60_000)

  return { startDate, endDate }
}

describe("computeWindow", () => {
  it("4 buckets x 15 min = 1h range", () => {
    const { startDate, endDate } = computeWindow("2026-01-10T14:00:00.000Z", 4, 15)
    expect(endDate.getTime() - startDate.getTime()).toBe(4 * 15 * 60_000)
    expect(startDate.toISOString()).toBe("2026-01-10T13:00:00.000Z")
    expect(endDate.toISOString()).toBe("2026-01-10T14:00:00.000Z")
  })

  it("200 buckets x 60 min = 12000 min range", () => {
    const { startDate, endDate } = computeWindow("2026-03-01T00:00:00.000Z", 200, 60)
    expect(endDate.getTime() - startDate.getTime()).toBe(200 * 60 * 60_000)
  })

  it("preserves the exact end date", () => {
    const { startDate, endDate } = computeWindow("2026-01-10T14:07:00.000Z", 4, 15)
    expect(endDate.toISOString()).toBe("2026-01-10T14:07:00.000Z")
    expect(startDate.toISOString()).toBe("2026-01-10T13:07:00.000Z")
  })

  it("uses current time when dateEnd is undefined", () => {
    const before = Date.now()
    const { endDate } = computeWindow(undefined, 10, 15)
    expect(endDate.getTime()).toBeLessThanOrEqual(before)
    expect(endDate.getTime()).toBeGreaterThan(before - 5_000)
  })

  it("throws on invalid dateEnd", () => {
    expect(() => computeWindow("not-a-date", 10, 15)).toThrow("Invalid oracle graph end date")
  })

  it("keeps a strictly positive window near the epoch", () => {
    const { startDate, endDate } = computeWindow("1970-01-01T00:01:00.000Z", 1, 60)
    expect(startDate.getTime()).toBeLessThan(endDate.getTime())
    expect(endDate.toISOString()).toBe("1970-01-01T00:01:00.000Z")
    expect(startDate.getTime()).toBe(-59 * 60_000)
  })
})
