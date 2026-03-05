/**
 * Seed script for monitoring API testing.
 * Populates all tables queried by the monitoring modules with realistic mock data.
 *
 * Usage: npx tsx src/scripts/seed-monitoring.ts
 */
import { PrismaClient } from "@prisma/client"
import { randomUUID } from "crypto"

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Market definitions based on real Tangent configs
// ---------------------------------------------------------------------------
const MARKETS = [
  { name: "crvUSD_USDC", type: "convex_curve", liqThreshold: 91.5, maxLtv: 91.4, maxDebt: 2_000_000, isStable: true },
  { name: "crvUSD_USDT", type: "convex_curve", liqThreshold: 94.0, maxLtv: 93.0, maxDebt: 2_000_000, isStable: true },
  { name: "USDC_USDT", type: "convex_curve", liqThreshold: 93.0, maxLtv: 92.5, maxDebt: 2_000_000, isStable: true },
  { name: "frxUSD_USDe", type: "convex_curve", liqThreshold: 93.0, maxLtv: 92.5, maxDebt: 2_000_000, isStable: true },
  { name: "frxETH_WETH", type: "convex_curve", liqThreshold: 85.0, maxLtv: 84.9, maxDebt: 2_000_000, isStable: false },
  { name: "pxETH_WETH", type: "convex_curve", liqThreshold: 93.0, maxLtv: 92.5, maxDebt: 2_000_000, isStable: false },
  { name: "cbBTC_WBTC", type: "convex_curve", liqThreshold: 93.0, maxLtv: 85.0, maxDebt: 2_000_000, isStable: false },
  { name: "USDT_WBTC_WETH", type: "convex_curve", liqThreshold: 93.0, maxLtv: 85.0, maxDebt: 2_000_000, isStable: false },
  { name: "CVX_ETH", type: "convex_curve", liqThreshold: 93.0, maxLtv: 85.0, maxDebt: 2_000_000, isStable: false },
  { name: "PYUSD_USDC", type: "curve_gauge", liqThreshold: 91.5, maxLtv: 90.0, maxDebt: 2_000_000, isStable: true },
  { name: "RLUSD_USDC", type: "curve_gauge", liqThreshold: 91.5, maxLtv: 90.0, maxDebt: 2_000_000, isStable: true },
  { name: "USDC_fxUSD", type: "convex_fxn", liqThreshold: 94.0, maxLtv: 90.0, maxDebt: 2_000_000, isStable: true },
]

const PEG_TOKENS = [
  { symbol: "USDC", peg_type: "USD", ref_address: null as string | null },
  { symbol: "USDT", peg_type: "USD", ref_address: null as string | null },
  { symbol: "crvUSD", peg_type: "USD", ref_address: null as string | null },
  { symbol: "PYUSD", peg_type: "USD", ref_address: null as string | null },
  { symbol: "GHO", peg_type: "USD", ref_address: null as string | null },
  { symbol: "USDe", peg_type: "USD", ref_address: null as string | null },
  { symbol: "frxUSD", peg_type: "USD", ref_address: null as string | null },
  { symbol: "RLUSD", peg_type: "USD", ref_address: null as string | null },
  { symbol: "fxUSD", peg_type: "USD", ref_address: null as string | null },
  { symbol: "stETH", peg_type: "ETH", ref_address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
  { symbol: "frxETH", peg_type: "ETH", ref_address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
  { symbol: "cbBTC", peg_type: "BTC", ref_address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599" },
  { symbol: "tBTC", peg_type: "BTC", ref_address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1))
}

function randomAddress(): string {
  const hex = "0123456789abcdef"
  let addr = "0x"
  for (let i = 0; i < 40; i++) addr += hex[randInt(0, 15)]
  return addr
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600_000)
}

function minutesAgo(m: number): Date {
  return new Date(Date.now() - m * 60_000)
}

// ---------------------------------------------------------------------------
// Seed functions (all using $executeRaw for multi-schema compat)
// ---------------------------------------------------------------------------
async function seedMarkets(): Promise<bigint[]> {
  const ids: bigint[] = []
  for (const m of MARKETS) {
    const result = await prisma.$queryRaw<{ id: bigint }[]>`
      INSERT INTO global.usg_markets (contract_name, collateral_address, contract_address, contract_type, is_active, create_block, create_date)
      VALUES (${m.name}, ${randomAddress()}, ${randomAddress()}, ${m.type}, true, ${BigInt(19_000_000 + randInt(0, 500_000))}, ${new Date("2024-06-01")})
      RETURNING id
    `
    ids.push(result[0].id)
  }
  console.log(`  usg_markets: ${ids.length} rows`)
  return ids
}

async function seedMarketConfig(marketIds: bigint[]) {
  for (let i = 0; i < marketIds.length; i++) {
    const m = MARKETS[i]
    await prisma.$executeRaw`
      INSERT INTO global.market_config (market_id, max_ltv, liquidation_threshold, max_debt, last_update)
      VALUES (${marketIds[i]}, ${m.maxLtv}, ${m.liqThreshold}, ${m.maxDebt}, ${new Date()})
    `
  }
  console.log(`  market_config: ${marketIds.length} rows`)
}

async function seedLatestGlobalData(marketIds: bigint[]) {
  for (let i = 0; i < marketIds.length; i++) {
    const totalDebt = rand(200_000, 1_800_000)
    const tvlUsd = totalDebt + rand(100_000, 800_000)
    const oraclePrice = MARKETS[i].isStable ? rand(0.995, 1.005) : rand(1500, 4000)

    await prisma.$executeRaw`
      INSERT INTO global.latest_global_data (market_id, timestamp, apr_projected, apr_current, tvl_usd, tvl_amount, total_debt, bad_debt, oracle_price, ir_apy, reward_cut)
      VALUES (
        ${marketIds[i]}, ${new Date()},
        ${JSON.stringify({ borrow: rand(2, 12) })}::jsonb,
        ${JSON.stringify({ borrow: rand(2, 12) })}::jsonb,
        ${tvlUsd}, ${tvlUsd / rand(0.8, 3.0)},
        ${totalDebt}, ${rand(0, totalDebt * 0.02)},
        ${oraclePrice}, ${rand(2, 15)}, ${rand(0, 0.05)}
      )
    `
  }
  console.log(`  latest_global_data: ${marketIds.length} rows`)
}

async function seedMarketGlobalDataHistory(marketIds: bigint[]) {
  let count = 0
  for (let i = 0; i < marketIds.length; i++) {
    const baseTvl = rand(500_000, 2_000_000)
    const baseTotalDebt = baseTvl * rand(0.3, 0.7)

    for (let h = 48; h >= 0; h--) {
      const drift = 1 + rand(-0.03, 0.02) * (h / 48)
      const tvlUsd = baseTvl * drift + rand(-20_000, 20_000)
      const totalDebt = Math.max(0, baseTotalDebt * drift + rand(-10_000, 10_000))
      const oraclePrice = MARKETS[i].isStable ? rand(0.99, 1.01) : rand(1500, 4000)

      await prisma.$executeRaw`
        INSERT INTO global.market_global_data (market_id, timestamp, apr_projected, apr_current, tvl_usd, tvl_amount, total_debt, bad_debt, oracle_price, ir_apy, reward_cut)
        VALUES (
          ${marketIds[i]}, ${hoursAgo(h)},
          ${JSON.stringify({ borrow: rand(2, 12) })}::jsonb,
          ${JSON.stringify({ borrow: rand(2, 12) })}::jsonb,
          ${tvlUsd}, ${tvlUsd / rand(0.8, 3.0)},
          ${totalDebt}, ${rand(0, 5000)},
          ${oraclePrice}, ${rand(2, 15)}, ${rand(0, 0.05)}
        )
      `
      count++
    }
  }
  console.log(`  market_global_data: ${count} rows`)
}

async function seedPositionSnapshots(marketIds: bigint[]) {
  let count = 0
  const borrowers = Array.from({ length: 80 }, () => randomAddress())

  // Target LTV buckets with desired distribution for diverse ltv_distribution module data
  // Each entry: [targetLtvPct, count] — positions will be spread across these bands per market
  const ltvBuckets: { range: [number, number]; count: number }[] = [
    { range: [15, 45], count: 4 }, // 0-50%   — very safe
    { range: [50, 68], count: 5 }, // 50-70%  — moderate
    { range: [70, 79], count: 4 }, // 70-80%  — getting close
    { range: [80, 89], count: 4 }, // 80-90%  — risky
    { range: [90, 99], count: 3 }, // 90%+    — near liquidation
    { range: [101, 115], count: 2 }, // 100%+   — underwater (bad debt)
  ]

  let borrowerIdx = 0

  for (let i = 0; i < marketIds.length; i++) {
    const liqThreshold = MARKETS[i].liqThreshold

    for (const bucket of ltvBuckets) {
      for (let b = 0; b < bucket.count; b++) {
        const borrower = borrowers[borrowerIdx % borrowers.length]
        borrowerIdx++

        const targetLtv = rand(bucket.range[0], bucket.range[1])

        for (const snapshotAge of [24, 0]) {
          const userDebt = rand(5_000, 200_000)
          // LTV = debt / positionValue * 100, so positionValue = debt / (ltv/100)
          const positionValueUsd = userDebt / (targetLtv / 100)
          // cr in same unit as liquidation_threshold (percentage), e.g. LTV=80% → cr=125
          const cr = (positionValueUsd / userDebt) * 100
          const margin = cr - liqThreshold
          const healthRatio = cr / liqThreshold
          const collateralBalance = positionValueUsd / (MARKETS[i].isStable ? 1.0 : rand(1500, 4000))
          const ltv = targetLtv
          const oraclePrice = MARKETS[i].isStable ? rand(0.995, 1.005) : rand(1500, 4000)
          const liquidationPrice = oraclePrice * (1 - rand(0.01, 0.15))
          const distancePct = ((oraclePrice - liquidationPrice) / oraclePrice) * 100

          await prisma.$executeRaw`
            INSERT INTO global.position_snapshots (market_id, borrower_address, collateral_balance, position_value_usd, user_debt, ltv, cr, margin, health_ratio, liquidation_price, distance_pct, snapshot_timestamp)
            VALUES (
              ${marketIds[i]}, ${borrower},
              ${collateralBalance}, ${positionValueUsd}, ${userDebt},
              ${ltv}, ${cr}, ${margin}, ${healthRatio},
              ${liquidationPrice}, ${distancePct}, ${hoursAgo(snapshotAge)}
            )
          `
          count++
        }
      }
    }
  }
  console.log(`  position_snapshots: ${count} rows`)
}

async function seedOracleSanitySnapshots(marketIds: bigint[]) {
  let count = 0
  for (let i = 0; i < marketIds.length; i++) {
    const basePrice = MARKETS[i].isStable ? rand(0.995, 1.005) : rand(2000, 3500)

    for (let m = 300; m >= 0; m -= 5) {
      const drift = rand(-0.005, 0.005)
      const oraclePrice = basePrice * (1 + drift)
      const offchainDeviation = rand(-0.02, 0.02)
      const offchainPrice = oraclePrice * (1 + offchainDeviation)
      const deviationPct = ((oraclePrice - offchainPrice) / offchainPrice) * 100

      await prisma.$executeRaw`
        INSERT INTO global.oracle_sanity_snapshots (market_id, oracle_price, offchain_price, deviation_pct, timestamp)
        VALUES (${marketIds[i]}, ${oraclePrice}, ${offchainPrice}, ${deviationPct}, ${minutesAgo(m)})
      `
      count++
    }
  }
  console.log(`  oracle_sanity_snapshots: ${count} rows`)
}

async function seedPegMonitoredTokens(): Promise<bigint[]> {
  const ids: bigint[] = []
  for (const token of PEG_TOKENS) {
    const result = await prisma.$queryRaw<{ id: bigint }[]>`
      INSERT INTO global.peg_monitored_tokens (symbol, address, peg_type, ref_address, active)
      VALUES (${token.symbol}, ${randomAddress()}, ${token.peg_type}, ${token.ref_address}, true)
      RETURNING id
    `
    ids.push(result[0].id)
  }
  console.log(`  peg_monitored_tokens: ${ids.length} rows`)
  return ids
}

async function seedPegSanitySnapshots(tokenIds: bigint[]) {
  let count = 0
  for (let i = 0; i < tokenIds.length; i++) {
    const token = PEG_TOKENS[i]
    const refPrice = token.peg_type === "USD" ? 1.0 : token.peg_type === "ETH" ? 2800.0 : 65000.0

    for (let m = 360; m >= 0; m -= 10) {
      const deviation = rand(-0.03, 0.03)
      const price = refPrice * (1 + deviation)
      const deviationPct = deviation * 100

      await prisma.$executeRaw`
        INSERT INTO global.peg_sanity_snapshots (token_id, price, ref_price, deviation_pct, timestamp)
        VALUES (${tokenIds[i]}, ${price}, ${refPrice}, ${deviationPct}, ${minutesAgo(m)})
      `
      count++
    }
  }
  console.log(`  peg_sanity_snapshots: ${count} rows`)
}

async function seedLiquidationExecutions() {
  let count = 0
  const marketNames = MARKETS.map((m) => m.name)

  const errorMessages = [
    "Insufficient profit margin",
    "Position already liquidated",
    "Slippage exceeded tolerance",
    "Gas price too high",
    "Oracle price stale",
    "Transaction reverted: health factor above threshold",
    "Collateral swap failed",
  ]

  // Explicit scenarios: mix of successes and failures across time periods
  const scenarios: { daysAgoRange: [number, number]; success: boolean; type: string; collateralRange: [number, number] }[] = [
    // Recent successes (last 24h) — active liquidation bot
    { daysAgoRange: [0, 1], success: true, type: "liquidation", collateralRange: [5_000, 30_000] },
    { daysAgoRange: [0, 1], success: true, type: "liquidation", collateralRange: [10_000, 80_000] },
    { daysAgoRange: [0, 1], success: true, type: "seizing", collateralRange: [2_000, 15_000] },
    // Recent failures (last 24h)
    { daysAgoRange: [0, 1], success: false, type: "liquidation", collateralRange: [3_000, 20_000] },
    { daysAgoRange: [0, 1], success: false, type: "liquidation", collateralRange: [1_000, 5_000] },
    // Last 7 days — mix
    { daysAgoRange: [1, 7], success: true, type: "liquidation", collateralRange: [20_000, 150_000] },
    { daysAgoRange: [1, 7], success: true, type: "liquidation", collateralRange: [8_000, 45_000] },
    { daysAgoRange: [1, 7], success: true, type: "seizing", collateralRange: [5_000, 25_000] },
    { daysAgoRange: [1, 7], success: true, type: "liquidation", collateralRange: [1_000, 10_000] },
    { daysAgoRange: [1, 7], success: false, type: "liquidation", collateralRange: [15_000, 60_000] },
    { daysAgoRange: [1, 7], success: false, type: "seizing", collateralRange: [2_000, 8_000] },
    { daysAgoRange: [1, 7], success: false, type: "liquidation", collateralRange: [500, 3_000] },
    // Last 30 days — bigger events
    { daysAgoRange: [7, 30], success: true, type: "liquidation", collateralRange: [50_000, 300_000] },
    { daysAgoRange: [7, 30], success: true, type: "liquidation", collateralRange: [30_000, 100_000] },
    { daysAgoRange: [7, 30], success: true, type: "seizing", collateralRange: [10_000, 50_000] },
    { daysAgoRange: [7, 30], success: true, type: "liquidation", collateralRange: [5_000, 40_000] },
    { daysAgoRange: [7, 30], success: true, type: "liquidation", collateralRange: [80_000, 200_000] },
    { daysAgoRange: [7, 30], success: false, type: "liquidation", collateralRange: [20_000, 90_000] },
    { daysAgoRange: [7, 30], success: false, type: "seizing", collateralRange: [5_000, 20_000] },
    { daysAgoRange: [7, 30], success: false, type: "liquidation", collateralRange: [10_000, 50_000] },
    // Extra random ones for volume
    { daysAgoRange: [2, 15], success: true, type: "liquidation", collateralRange: [3_000, 25_000] },
    { daysAgoRange: [2, 15], success: true, type: "liquidation", collateralRange: [7_000, 35_000] },
    { daysAgoRange: [3, 20], success: false, type: "liquidation", collateralRange: [1_000, 12_000] },
    { daysAgoRange: [5, 25], success: true, type: "seizing", collateralRange: [15_000, 70_000] },
    { daysAgoRange: [0, 3], success: false, type: "seizing", collateralRange: [4_000, 18_000] },
  ]

  for (const s of scenarios) {
    const daysAgo = rand(s.daysAgoRange[0], s.daysAgoRange[1])
    const market = marketNames[randInt(0, marketNames.length - 1)]
    const collateralUsd = rand(s.collateralRange[0], s.collateralRange[1])
    const profit = s.success ? rand(50, collateralUsd * 0.08) : 0
    const badDebt = !s.success && Math.random() > 0.5 ? rand(100, collateralUsd * 0.03) : 0
    const txHash = s.success ? `0x${Array.from({ length: 64 }, () => "0123456789abcdef"[randInt(0, 15)]).join("")}` : null
    const errorMsg = s.success ? null : errorMessages[randInt(0, errorMessages.length - 1)]

    await prisma.$executeRaw`
      INSERT INTO global.liquidation_execution (execution_key, market, borrower, type, success, collateral_liquidated, profit, tx_hash, error_message, date)
      VALUES (
        ${randomUUID()}::uuid, ${market}, ${randomAddress()},
        ${s.type},
        ${s.success},
        ${`$${collateralUsd.toFixed(0)}`},
        ${s.success ? `+$${profit.toFixed(0)}` : `-$${badDebt.toFixed(0)}`},
        ${txHash},
        ${errorMsg},
        ${new Date(Date.now() - daysAgo * 86_400_000)}
      )
    `
    count++
  }
  console.log(`  liquidation_execution: ${count} rows`)
}

async function seedEventBlocks() {
  const latestBlock = 19_500_000
  for (let i = 0; i < 10; i++) {
    await prisma.$executeRaw`
      INSERT INTO events.event_blocks (block_id, created_at)
      VALUES (${BigInt(latestBlock - (9 - i))}, ${minutesAgo((9 - i) * 0.2)})
      ON CONFLICT (block_id) DO NOTHING
    `
  }
  console.log(`  event_blocks: 10 rows`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Seeding monitoring mock data...\n")

  console.log("Step 1/8: Markets")
  const marketIds = await seedMarkets()

  console.log("Step 2/8: Market config")
  await seedMarketConfig(marketIds)

  console.log("Step 3/8: Latest global data")
  await seedLatestGlobalData(marketIds)

  console.log("Step 4/8: Market global data history (48h)")
  await seedMarketGlobalDataHistory(marketIds)

  console.log("Step 5/8: Position snapshots")
  await seedPositionSnapshots(marketIds)

  console.log("Step 6/8: Oracle sanity snapshots (5h)")
  await seedOracleSanitySnapshots(marketIds)

  console.log("Step 7/8: Peg monitoring")
  const tokenIds = await seedPegMonitoredTokens()
  await seedPegSanitySnapshots(tokenIds)

  console.log("Step 8/8: Liquidations & blocks")
  await seedLiquidationExecutions()
  await seedEventBlocks()

  console.log("\nDone! Summary:")
  console.log(`  ${MARKETS.length} markets`)
  console.log(`  ${PEG_TOKENS.length} peg tokens`)
  console.log("  ~80 borrowers across markets (diverse LTV: 15-115%)")
  console.log("  48h of hourly market history")
  console.log("  5h of oracle snapshots at 5min intervals")
  console.log("  6h of peg snapshots at 10min intervals")
  console.log("  25 liquidation events (successes + failures) over 30 days")
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
