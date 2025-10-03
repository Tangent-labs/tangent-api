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

async function main() {
  const rand = mulberry32(SEED)

  const start = new Date(`${START_ISO}T00:00:00Z`)
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid start date "${START_ISO}". Use YYYY-MM-DD.`)
  }

  const rows: {
    token_id: bigint
    timestamp: Date
    total_supply: string
  }[] = []

  let supply = BASE_SUPPLY

  for (let i = 0; i < DAYS; i++) {
    const ts = new Date(start.getTime())
    ts.setUTCDate(start.getUTCDate() + i)

    const sign = rand() < 0.5 ? -1n : 1n
    const magTokens = BigInt(Math.floor(rand() * Number(MAX_DAILY_CHANGE_TOKENS + 1n)))
    const delta = sign * magTokens * ONE

    const next = supply + delta
    supply = next > 0n ? next : 0n

    rows.push({
      token_id: 639n,
      timestamp: ts,
      total_supply: supply.toString(),
    })
  }
  const result = await prisma.total_supplies.createMany({
    data: rows,
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
