/**
 * Backfill mock oracle price history for a single market in global.market_global_data.
 *
 * The script inserts one point per hour for the requested window when a row does not
 * already exist at that timestamp, and updates oracle_price when a row already exists.
 *
 * Usage:
 *   npm run mock:oracle-history
 */
import dotenv from "dotenv"
import { PrismaClient } from "@prisma/client"

dotenv.config()

const prisma = new PrismaClient()

const TARGET_MARKET_ADDRESS = "0x8095f7eD22f4561C08F45003435fA97DbC487fBf"
const TARGET_DAYS = 124
const TARGET_STEP_MINUTES = 15

type ReferenceRow = {
  id: bigint
  timestamp: Date
  apr_projected: unknown
  apr_current: unknown
  tvl_usd: number
  tvl_amount: number
  total_debt: number
  bad_debt: number
  oracle_price: number
  ir_apy: number
  reward_cut: number
}

function deterministicNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x) - 0.5
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function gaussian(x: number, center: number, width: number): number {
  const scaled = (x - center) / width
  return Math.exp(-(scaled * scaled))
}

function buildOraclePrice(basePrice: number, progress: number, hourIndex: number): number {
  const trend = basePrice * 0.008 * (progress - 0.5)
  const weeklyWave = basePrice * 0.0022 * Math.sin(progress * Math.PI * 5.5)
  const dailyWave = basePrice * 0.0011 * Math.sin(progress * Math.PI * 60)
  const shortWave = basePrice * 0.00045 * Math.cos(progress * Math.PI * 190)
  const drawdown = -basePrice * 0.014 * gaussian(progress, 0.58, 0.035)
  const rebound = basePrice * 0.0065 * gaussian(progress, 0.74, 0.05)
  const noise = basePrice * deterministicNoise(hourIndex + 1) * 0.00085

  return clamp(basePrice + trend + weeklyWave + dailyWave + shortWave + drawdown + rebound + noise, 0.5, basePrice * 1.35)
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

async function main() {
  const marketAddress = TARGET_MARKET_ADDRESS.toLowerCase()
  const days = TARGET_DAYS
  const stepMinutes = TARGET_STEP_MINUTES

  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`Invalid TARGET_DAYS value: ${TARGET_DAYS}`)
  }

  if (!Number.isFinite(stepMinutes) || stepMinutes <= 0) {
    throw new Error(`Invalid TARGET_STEP_MINUTES value: ${TARGET_STEP_MINUTES}`)
  }

  const [market] = await prisma.$queryRaw<{ id: bigint; contract_name: string }[]>`
    SELECT id, contract_name
    FROM global.usg_markets
    WHERE LOWER(contract_address) = LOWER(${marketAddress})
    LIMIT 1
  `

  if (!market) {
    throw new Error(`Market not found for address ${marketAddress}`)
  }

  const [reference] = await prisma.$queryRaw<ReferenceRow[]>`
    SELECT
      id,
      timestamp,
      apr_projected,
      apr_current,
      tvl_usd,
      tvl_amount,
      total_debt,
      bad_debt,
      oracle_price,
      ir_apy,
      reward_cut
    FROM global.market_global_data
    WHERE market_id = ${market.id}
    ORDER BY timestamp DESC, id DESC
    LIMIT 1
  `

  if (!reference) {
    throw new Error(`No reference row found in global.market_global_data for ${marketAddress}`)
  }

  const end = new Date()
  end.setUTCMinutes(Math.floor(end.getUTCMinutes() / stepMinutes) * stepMinutes, 0, 0)

  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - days)
  start.setUTCMinutes(Math.floor(start.getUTCMinutes() / stepMinutes) * stepMinutes, 0, 0)

  const timestamps = buildTimestamps(start, end, stepMinutes)

  const existingRows = await prisma.$queryRaw<{ id: bigint; timestamp: Date }[]>`
    SELECT id, timestamp
    FROM global.market_global_data
    WHERE market_id = ${market.id}
      AND (timestamp AT TIME ZONE 'UTC') >= ${start.toISOString()}::timestamptz
      AND (timestamp AT TIME ZONE 'UTC') <= ${end.toISOString()}::timestamptz
    ORDER BY timestamp ASC, id ASC
  `

  const existingByTimestamp = new Map(existingRows.map((row) => [row.timestamp.toISOString(), row.id]))
  const totalPoints = Math.max(timestamps.length - 1, 1)
  const basePrice = Number(reference.oracle_price || 1.01)

  let inserted = 0
  let updated = 0

  console.log(`Backfilling mock oracle history for ${market.contract_name} (${marketAddress})`)
  console.log(`Window: ${start.toISOString()} -> ${end.toISOString()}`)
  console.log(`Cadence: every ${stepMinutes}m`)
  console.log(`Reference base price: ${basePrice.toFixed(6)}`)

  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i]
    const progress = i / totalPoints
    const oraclePrice = buildOraclePrice(basePrice, progress, i)
    const existingId = existingByTimestamp.get(ts.toISOString())

    if (existingId) {
      await prisma.$executeRaw`
        UPDATE global.market_global_data
        SET oracle_price = ${oraclePrice}
        WHERE id = ${existingId}
      `
      updated++
      continue
    }

    const tvlDrift = 1 + 0.025 * Math.sin(progress * Math.PI * 3.2) + deterministicNoise(i + 11) * 0.01
    const debtDrift = 1 + 0.02 * Math.cos(progress * Math.PI * 2.3) + deterministicNoise(i + 29) * 0.008
    const tvlUsd = clamp(reference.tvl_usd * tvlDrift, 1, Number.MAX_SAFE_INTEGER)
    const tvlAmount = clamp(reference.tvl_amount * tvlDrift, 1, Number.MAX_SAFE_INTEGER)
    const totalDebt = clamp(reference.total_debt * debtDrift, 0, Number.MAX_SAFE_INTEGER)
    const badDebt = clamp(reference.bad_debt * (1 + deterministicNoise(i + 47) * 0.1), 0, Number.MAX_SAFE_INTEGER)

    await prisma.$executeRaw`
      INSERT INTO global.market_global_data (
        market_id,
        timestamp,
        apr_projected,
        apr_current,
        tvl_usd,
        tvl_amount,
        total_debt,
        bad_debt,
        oracle_price,
        ir_apy,
        reward_cut
      )
      VALUES (
        ${market.id},
        ${ts},
        ${JSON.stringify(reference.apr_projected)}::jsonb,
        ${JSON.stringify(reference.apr_current)}::jsonb,
        ${tvlUsd},
        ${tvlAmount},
        ${totalDebt},
        ${badDebt},
        ${oraclePrice},
        ${reference.ir_apy},
        ${reference.reward_cut}
      )
    `
    inserted++
  }

  const [latestMockedPriceRow] = await prisma.$queryRaw<{ oracle_price: number }[]>`
    SELECT oracle_price
    FROM global.market_global_data
    WHERE market_id = ${market.id}
    ORDER BY timestamp DESC, id DESC
    LIMIT 1
  `

  if (latestMockedPriceRow) {
    await prisma.$executeRaw`
      UPDATE global.latest_global_data
      SET oracle_price = ${latestMockedPriceRow.oracle_price}
      WHERE market_id = ${market.id}
    `
  }

  console.log(`Rows updated: ${updated}`)
  console.log(`Rows inserted: ${inserted}`)
  console.log("Updated global.latest_global_data.oracle_price")
}

main()
  .catch((error) => {
    console.error("Mock oracle history failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
