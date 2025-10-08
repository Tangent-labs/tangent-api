import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const START_ISO = process.argv[3] ?? "2024-08-01"
const DAYS = Number(process.argv[4] ?? "365")
const SEED = Number(process.argv[5] ?? "1337")
const MAX_DAILY_CHANGE_TOKENS = BigInt(process.argv[6] ?? "20000")

const DECIMALS = 18n
const ONE = 10n ** DECIMALS

const BASE_SUPPLY = 1_000_000_000n * ONE

function mulberry32(seed: number) {
  let t = seed >>> 0
  return function () {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function addDaysUTC(d: Date, days: number) {
  const nd = new Date(d.getTime())
  nd.setUTCDate(nd.getUTCDate() + days)
  return nd
}

async function main() {
  const start = new Date(`${START_ISO}T00:00:00Z`)
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid start date "${START_ISO}". Use YYYY-MM-DD.`)
  }

  // Generate rows for both tokens
  const tokenIds = [647n, 648n] as const

  const allRows: {
    token_id: bigint
    timestamp: Date
    total_supply: string
  }[] = []

  for (let t = 0; t < tokenIds.length; t++) {
    const tokenId = tokenIds[t]
    // Give each token its own deterministic PRNG stream
    const rand = mulberry32(SEED + t)

    let supply = BASE_SUPPLY

    // Track last week's *target* to enforce +10% weekly growth
    // Week 0 baseline is BASE_SUPPLY; week 1 target = 1.1 * BASE_SUPPLY, etc.
    let lastWeekTarget = BASE_SUPPLY

    for (let i = 0; i < DAYS; i++) {
      const ts = addDaysUTC(start, i)

      // daily random wiggle (can go up or down)
      const sign = rand() < 0.5 ? -1n : 1n
      const magTokens = BigInt(Math.floor(rand() * Number(MAX_DAILY_CHANGE_TOKENS + 1n)))
      const delta = sign * magTokens * ONE

      let next = supply + delta
      if (next < 0n) next = 0n // floor at zero

      // If today is the end of a 7-day block, force the weekly target:
      // supply(end of this week) = 110% of last week's target (compounding).
      const isEndOfWeek = (i + 1) % 7 === 0
      if (isEndOfWeek) {
        const target = (lastWeekTarget * 110n) / 100n // exact +10% weekly step
        next = target
        lastWeekTarget = target
      }

      supply = next

      allRows.push({
        token_id: tokenId,
        timestamp: ts,
        total_supply: supply.toString(),
      })
    }
  }

  await prisma.total_supplies.createMany({
    data: allRows,
    skipDuplicates: true,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
