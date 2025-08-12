export function rangeToMinDate(range: string): string | null {
  if (range === "all") return "2025-01-01"

  const base = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), 0, 0, 0, 0))

  switch (range) {
    case "1w":
      base.setUTCDate(base.getUTCDate() - 7)
      break
    case "1m":
      base.setUTCMonth(base.getUTCMonth() - 1)
      break
    case "1y":
      base.setUTCFullYear(base.getUTCFullYear() - 1)
      break
  }

  return base.toISOString().split(".")[0] + "Z"
}
