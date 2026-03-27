/**
 * Backfill mock oracle price history for a single market in global.market_global_data.
 *
 * The script deletes existing rows in the window, then inserts fresh data points
 * with oracle prices between PRICE_MIN and PRICE_MAX.
 *
 * Usage:
 *   npm run mock:oracle-history
 */
import dotenv from "dotenv"
import { PrismaClient } from "@prisma/client"

dotenv.config()

if (process.env.NODE_ENV === "production") {
  console.error("This mock script must NOT be run in production.")
  process.exit(1)
}

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

const PRICE_MIN = 1.015
const PRICE_MAX = 1.016
const PRICE_MID = (PRICE_MIN + PRICE_MAX) / 2
const PRICE_HALF_RANGE = (PRICE_MAX - PRICE_MIN) / 2

function buildOraclePrice(progress: number, hourIndex: number): number {
  const trend = PRICE_HALF_RANGE * 0.3 * Math.sin(progress * Math.PI * 2)
  const wave = PRICE_HALF_RANGE * 0.4 * Math.sin(progress * Math.PI * 14)
  const noise = PRICE_HALF_RANGE * deterministicNoise(hourIndex + 1) * 0.6

  return clamp(PRICE_MID + trend + wave + noise, PRICE_MIN, PRICE_MAX)
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

  // Clean up previously injected rows in the window
  const deleted = await prisma.$executeRaw`
    DELETE FROM global.market_global_data
    WHERE market_id = ${market.id}
      AND (timestamp AT TIME ZONE 'UTC') >= ${start.toISOString()}::timestamptz
      AND (timestamp AT TIME ZONE 'UTC') <= ${end.toISOString()}::timestamptz
  `

  const totalPoints = Math.max(timestamps.length - 1, 1)

  let inserted = 0

  console.log(`Backfilling mock oracle history for ${market.contract_name} (${marketAddress})`)
  console.log(`Window: ${start.toISOString()} -> ${end.toISOString()}`)
  console.log(`Deleted ${deleted} existing rows`)
  console.log(`Cadence: every ${stepMinutes}m`)
  console.log(`Price range: ${PRICE_MIN} - ${PRICE_MAX}`)

  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i]
    const progress = i / totalPoints
    const oraclePrice = buildOraclePrice(progress, i)

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
