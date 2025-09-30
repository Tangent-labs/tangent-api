/**
 *
 * @param range provided by the frontend
 * @param endDate provided by the frontend
 * Compute the starting date of the period to cover based on range and current date
 * @returns
 */
export const rangeToMinDate = (range: string, endDate: string | number): string => {
  if (range === "all") return "1970-01-01T00:00:00Z"

  const end = new Date(endDate)
  if (Number.isNaN(end.getTime())) {
    throw new Error(`Invalid end date: ${endDate}`)
  }

  const base = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 0, 0, 0, 0))

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