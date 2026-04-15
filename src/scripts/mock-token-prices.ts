/**
 * Backfill mock token prices for USG and sUSG in points.price_feeds, then
 * refresh points.last_price_feeds so /prices returns the mocked values.
 *
 * Required env vars:
 *   MOCK_USG_ADDRESS
 *   MOCK_SUSG_ADDRESS
 *
 * Optional env vars:
 *   MOCK_PRICE_DAYS=365
 *   MOCK_PRICE_STEP_MINUTES=60
 *   MOCK_USG_PRICE_MIN=0.998
 *   MOCK_USG_PRICE_MAX=1.002
 *   MOCK_SUSG_PRICE_MIN=1.045
 *   MOCK_SUSG_PRICE_MAX=1.075
 *
 * Usage:
 *   npm run mock:token-prices
 */
import dotenv from "dotenv"
import { PrismaClient } from "@prisma/client"
import { isAddress } from "ethers"

dotenv.config()

if (process.env.NODE_ENV === "production") {
  console.error("This mock script must NOT be run in production.")
  process.exit(1)
}

const prisma = new PrismaClient()

type TokenConfig = {
  label: string
  address?: string
  min: number
  max: number
  waveCount: number
}

type PriceSourceRow = {
  id: bigint
  address: string
}

function deterministicNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x) - 0.5
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function parseNumberEnv(name: string, fallback: number): number {
  const value = process.env[name]
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric env var ${name}: ${value}`)
  }

  return parsed
}

function readOptionalAddressEnv(name: string): string | undefined {
  const value = process.env[name]
  if (!value) {
    return undefined
  }

  const normalized = value.toLowerCase()
  if (!isAddress(normalized)) {
    throw new Error(`Invalid address in env var ${name}: ${value}`)
  }

  return normalized
}

function buildTimestamps(start: Date, end: Date, stepMinutes: number): Date[] {
  const timestamps: Date[] = []
  const current = new Date(start)

  while (current <= end) {
    timestamps.push(new Date(current))
    current.setUTCMinutes(current.getUTCMinutes() + stepMinutes)
  }

  return timestamps
}

function buildPrice(config: TokenConfig, progress: number, pointIndex: number): number {
  const mid = (config.min + config.max) / 2
  const halfRange = (config.max - config.min) / 2
  const trend = halfRange * 0.35 * Math.sin(progress * Math.PI * 2)
  const wave = halfRange * 0.45 * Math.sin(progress * Math.PI * config.waveCount)
  const noise = halfRange * deterministicNoise(pointIndex + 1) * 0.5

  return clamp(mid + trend + wave + noise, config.min, config.max)
}

async function upsertLastPrice(priceSourceId: bigint, priceUsd: number) {
  await prisma.$executeRaw`
    DELETE FROM points.last_price_feeds
    WHERE price_source_id = ${priceSourceId}
  `

  await prisma.$executeRaw`
    INSERT INTO points.last_price_feeds (price_source_id, price_usd)
    VALUES (${priceSourceId}, ${priceUsd})
  `
}

async function seedTokenPriceHistory(config: TokenConfig, priceSourceId: bigint, start: Date, end: Date, stepMinutes: number) {
  const deleted = await prisma.$executeRaw`
    DELETE FROM points.price_feeds
    WHERE price_source_id = ${priceSourceId}
      AND timestamp >= ${start}
      AND timestamp <= ${end}
  `

  const timestamps = buildTimestamps(start, end, stepMinutes)
  const totalPoints = Math.max(timestamps.length - 1, 1)

  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i]
    const priceUsd = buildPrice(config, i / totalPoints, i)

    await prisma.$executeRaw`
      INSERT INTO points.price_feeds (price_source_id, timestamp, price_usd)
      VALUES (${priceSourceId}, ${timestamp}, ${priceUsd})
    `
  }

  const latestPrice = buildPrice(config, 1, timestamps.length - 1)
  await upsertLastPrice(priceSourceId, latestPrice)

  console.log(`${config.label}: deleted ${deleted} rows, inserted ${timestamps.length} rows, latest=${latestPrice.toFixed(6)}`)
}

async function resolvePriceSourceIds(tokens: TokenConfig[]): Promise<Map<string, bigint>> {
  const requestedAddresses = tokens.map((token) => token.address).filter((address): address is string => Boolean(address))
  const tokenLabels = tokens.map((token) => token.label.toLowerCase())

  const rows = await prisma.$queryRaw<PriceSourceRow[]>`
    SELECT id, LOWER(address) AS address
    FROM points.price_source
    WHERE LOWER(name) IN (${tokenLabels[0]}, ${tokenLabels[1]})
       OR LOWER(address) IN (${requestedAddresses[0] ?? ""}, ${requestedAddresses[1] ?? ""})
  `

  const rowsByAddress = new Map(rows.map((row) => [row.address, row.id]))
  const rowsByName = new Map<string, bigint>()

  const namedRows = await prisma.$queryRaw<Array<{ id: bigint; name: string }>>`
    SELECT id, LOWER(name) AS name
    FROM points.price_source
    WHERE LOWER(name) IN (${tokenLabels[0]}, ${tokenLabels[1]})
  `

  for (const row of namedRows) {
    rowsByName.set(row.name, row.id)
  }

  const resolved = new Map<string, bigint>()

  for (const token of tokens) {
    const byAddress = token.address ? rowsByAddress.get(token.address) : undefined
    const byName = rowsByName.get(token.label.toLowerCase())
    const priceSourceId = byAddress ?? byName

    if (!priceSourceId) {
      throw new Error(`No points.price_source row found for ${token.label}`)
    }

    resolved.set(token.label, priceSourceId)
  }

  return resolved
}

async function main() {
  const days = parseNumberEnv("MOCK_PRICE_DAYS", 365)
  const stepMinutes = parseNumberEnv("MOCK_PRICE_STEP_MINUTES", 60)

  if (!Number.isInteger(days) || days <= 0) {
    throw new Error(`Invalid MOCK_PRICE_DAYS: ${days}`)
  }

  if (!Number.isInteger(stepMinutes) || stepMinutes <= 0) {
    throw new Error(`Invalid MOCK_PRICE_STEP_MINUTES: ${stepMinutes}`)
  }

  const tokens: TokenConfig[] = [
    {
      label: "USG",
      address: readOptionalAddressEnv("MOCK_USG_ADDRESS"),
      min: parseNumberEnv("MOCK_USG_PRICE_MIN", 0.998),
      max: parseNumberEnv("MOCK_USG_PRICE_MAX", 1.002),
      waveCount: 10,
    },
    {
      label: "sUSG",
      address: readOptionalAddressEnv("MOCK_SUSG_ADDRESS"),
      min: parseNumberEnv("MOCK_SUSG_PRICE_MIN", 1.045),
      max: parseNumberEnv("MOCK_SUSG_PRICE_MAX", 1.075),
      waveCount: 6,
    },
  ]

  for (const token of tokens) {
    if (token.min <= 0 || token.max <= 0 || token.min > token.max) {
      throw new Error(`Invalid price range for ${token.label}: ${token.min} -> ${token.max}`)
    }
  }

  const end = new Date()
  end.setUTCMinutes(Math.floor(end.getUTCMinutes() / stepMinutes) * stepMinutes, 0, 0)

  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - days)
  start.setUTCMinutes(Math.floor(start.getUTCMinutes() / stepMinutes) * stepMinutes, 0, 0)

  const priceSourceIds = await resolvePriceSourceIds(tokens)

  console.log(`Mocking token prices from ${start.toISOString()} to ${end.toISOString()} every ${stepMinutes} minutes`)

  for (const token of tokens) {
    const priceSourceId = priceSourceIds.get(token.label)!
    await seedTokenPriceHistory(token, priceSourceId, start, end, stepMinutes)
  }
}

main()
  .catch((error) => {
    console.error("Mock token prices failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
