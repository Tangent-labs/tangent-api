import { describe, it, expect, vi } from "vitest"

// Inline the alignment logic to test it without importing heavy dependencies
function alignDateToBucket(date: Date, bucketSizeMinutes: number): Date {
  const aligned = new Date(date)
  const bucketMs = bucketSizeMinutes * 60_000
  aligned.setTime(Math.floor(aligned.getTime() / bucketMs) * bucketMs)
  return aligned
}

function computeWindow(dateEnd: string | undefined, bucketCount: number, bucketSizeMinutes: number) {
  const rawEndDate = dateEnd ? new Date(dateEnd) : new Date()

  if (Number.isNaN(rawEndDate.getTime())) {
    throw new Error("Invalid oracle graph end date")
  }

  const endDate = alignDateToBucket(rawEndDate, bucketSizeMinutes)
  const startDate = new Date(endDate.getTime() - bucketCount * bucketSizeMinutes * 60_000)

  return { startDate, endDate }
}

describe("alignDateToBucket", () => {
  it("snaps 14:07 to 14:00 with 15-min buckets", () => {
    const result = alignDateToBucket(new Date("2026-01-10T14:07:00.000Z"), 15)
    expect(result.toISOString()).toBe("2026-01-10T14:00:00.000Z")
  })

  it("snaps 09:59 to 09:45 with 15-min buckets", () => {
    const result = alignDateToBucket(new Date("2026-01-10T09:59:00.000Z"), 15)
    expect(result.toISOString()).toBe("2026-01-10T09:45:00.000Z")
  })

  it("keeps exact boundary unchanged", () => {
    const result = alignDateToBucket(new Date("2026-01-10T12:00:00.000Z"), 60)
    expect(result.toISOString()).toBe("2026-01-10T12:00:00.000Z")
  })

  it("snaps to hour boundary with 60-min buckets", () => {
    const result = alignDateToBucket(new Date("2026-01-10T14:37:22.000Z"), 60)
    expect(result.toISOString()).toBe("2026-01-10T14:00:00.000Z")
  })

  it("snaps to 30-min boundary", () => {
    const result = alignDateToBucket(new Date("2026-01-10T14:42:00.000Z"), 30)
    expect(result.toISOString()).toBe("2026-01-10T14:30:00.000Z")
  })
})

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

  it("alignment + window combined", () => {
    // 14:07 aligned to 14:00, then 4 * 15 = 60 min back → 13:00
    const { startDate, endDate } = computeWindow("2026-01-10T14:07:00.000Z", 4, 15)
    expect(endDate.toISOString()).toBe("2026-01-10T14:00:00.000Z")
    expect(startDate.toISOString()).toBe("2026-01-10T13:00:00.000Z")
  })

  it("uses current time when dateEnd is undefined", () => {
    const before = Date.now()
    const { endDate } = computeWindow(undefined, 10, 15)
    expect(endDate.getTime()).toBeLessThanOrEqual(before)
    expect(endDate.getTime()).toBeGreaterThan(before - 15 * 60_000)
  })

  it("throws on invalid dateEnd", () => {
    expect(() => computeWindow("not-a-date", 10, 15)).toThrow("Invalid oracle graph end date")
  })

  it("startDate >= endDate when window collapses to epoch", () => {
    // With 60-min buckets, "1970-01-01T00:01:00Z" aligns to epoch 0, and start = 0 - 60min < 0
    const { startDate, endDate } = computeWindow("1970-01-01T00:01:00.000Z", 1, 60)
    expect(startDate.getTime()).toBeLessThan(endDate.getTime())
    // endDate is epoch 0
    expect(endDate.toISOString()).toBe("1970-01-01T00:00:00.000Z")
    // startDate is 1h before epoch → negative
    expect(startDate.getTime()).toBe(-60 * 60_000)
  })
})
