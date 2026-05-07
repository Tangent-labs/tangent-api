/**
 * Backfill mock indexer execution logs for richer indexer_health monitoring.
 *
 * The script deletes existing rows for the configured mock indexers, then
 * inserts deterministic scenarios covering fresh, stale, failing, and missing
 * execution data.
 *
 * Optional env vars:
 *   MOCK_INDEXER_EXECUTION_DAYS=3
 *
 * Usage:
 *   npm run mock:indexer-executions
 */
import dotenv from "dotenv"
import { Prisma, PrismaClient } from "@prisma/client"
import { INDEXER_HEALTH_THRESHOLDS } from "../services/monitoring/monitoring.types.js"

dotenv.config()

if (process.env.NODE_ENV === "production") {
  console.error("This mock script must NOT be run in production.")
  process.exit(1)
}

const prisma = new PrismaClient()

type ExecutionStatus = "SUCCESS" | "FAILED"

type ExecutionPoint = {
  indexerName: string
  status: ExecutionStatus
  finishedAt: Date
  durationSeconds: number
  errorMessage?: string | null
}

type Scenario =
  | {
      kind: "cadence"
      indexerName: string
      everyMinutes: number
      latestMinutesAgo: number
      failuresAtMinutesAgo?: number[]
    }
  | {
      kind: "stale"
      indexerName: string
      latestSuccessMinutesAgo: number
      previousEveryMinutes: number
    }
  | {
      kind: "failure_streak"
      indexerName: string
      latestSuccessMinutesAgo: number
      failureMinutesAgo: number[]
    }
  | {
      kind: "missing"
      indexerName: string
    }

function parseIntegerEnv(name: string, fallback: number): number {
  const value = process.env[name]
  if (!value) return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer env var ${name}: ${value}`)
  }

  return parsed
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000)
}

function deterministicDuration(index: number): number {
  return 8 + ((index * 17) % 43)
}

function buildCadenceScenario(scenario: Extract<Scenario, { kind: "cadence" }>, days: number): ExecutionPoint[] {
  const points: ExecutionPoint[] = []
  const windowMinutes = days * 24 * 60
  const failureSet = new Set(scenario.failuresAtMinutesAgo ?? [])

  let pointIndex = 0
  for (let minutes = scenario.latestMinutesAgo; minutes <= windowMinutes; minutes += scenario.everyMinutes) {
    const status: ExecutionStatus = failureSet.has(minutes) ? "FAILED" : "SUCCESS"
    points.push({
      indexerName: scenario.indexerName,
      status,
      finishedAt: minutesAgo(minutes),
      durationSeconds: deterministicDuration(pointIndex),
      errorMessage: status === "FAILED" ? `Mock failure for ${scenario.indexerName}` : null,
    })
    pointIndex++
  }

  return points
}

function buildStaleScenario(scenario: Extract<Scenario, { kind: "stale" }>, days: number): ExecutionPoint[] {
  return buildCadenceScenario(
    {
      kind: "cadence",
      indexerName: scenario.indexerName,
      everyMinutes: scenario.previousEveryMinutes,
      latestMinutesAgo: scenario.latestSuccessMinutesAgo,
    },
    days
  )
}

function buildFailureStreakScenario(scenario: Extract<Scenario, { kind: "failure_streak" }>, days: number): ExecutionPoint[] {
  const points = buildCadenceScenario(
    {
      kind: "cadence",
      indexerName: scenario.indexerName,
      everyMinutes: 15,
      latestMinutesAgo: scenario.latestSuccessMinutesAgo,
    },
    days
  )

  for (let i = 0; i < scenario.failureMinutesAgo.length; i++) {
    points.push({
      indexerName: scenario.indexerName,
      status: "FAILED",
      finishedAt: minutesAgo(scenario.failureMinutesAgo[i]),
      durationSeconds: deterministicDuration(points.length + i),
      errorMessage: `Consecutive mock failure ${i + 1} for ${scenario.indexerName}`,
    })
  }

  return points
}

function buildScenarioPoints(scenario: Scenario, days: number): ExecutionPoint[] {
  if (scenario.kind === "missing") return []
  if (scenario.kind === "cadence") return buildCadenceScenario(scenario, days)
  if (scenario.kind === "stale") return buildStaleScenario(scenario, days)
  return buildFailureStreakScenario(scenario, days)
}

async function insertExecution(point: ExecutionPoint) {
  const startedAt = new Date(point.finishedAt.getTime() - point.durationSeconds * 1000)

  await prisma.$executeRaw`
    INSERT INTO "global"."indexer_execution_log" (
      indexer_name,
      status,
      started_at,
      finished_at,
      error_message
    )
    VALUES (
      ${point.indexerName},
      ${point.status}::"global"."IndexerExecutionStatus",
      ${startedAt},
      ${point.finishedAt},
      ${point.errorMessage ?? null}
    )
  `
}

async function main() {
  const days = parseIntegerEnv("MOCK_INDEXER_EXECUTION_DAYS", 3)
  const configuredIndexerNames = Object.keys(INDEXER_HEALTH_THRESHOLDS.indexers)

  const scenarios: Scenario[] = [
    { kind: "cadence", indexerName: "block_indexer", everyMinutes: 1, latestMinutesAgo: 1, failuresAtMinutesAgo: [483] },
    { kind: "stale", indexerName: "global_data_indexer", latestSuccessMinutesAgo: 25, previousEveryMinutes: 30 },
    { kind: "failure_streak", indexerName: "liquidation_check", latestSuccessMinutesAgo: 35, failureMinutesAgo: [2, 5, 8] },
    { kind: "stale", indexerName: "liquidation_process", latestSuccessMinutesAgo: 20, previousEveryMinutes: 15 },
    { kind: "missing", indexerName: "monitoring_check" },
    { kind: "cadence", indexerName: "onchain_tx_bot", everyMinutes: 60, latestMinutesAgo: 20, failuresAtMinutesAgo: [260] },
    { kind: "stale", indexerName: "peg_keeper_update", latestSuccessMinutesAgo: 140, previousEveryMinutes: 180 },
    { kind: "cadence", indexerName: "points_lp_indexer", everyMinutes: 1440, latestMinutesAgo: 600 },
    { kind: "stale", indexerName: "points_votes_indexer", latestSuccessMinutesAgo: 3000, previousEveryMinutes: 1440 },
    { kind: "failure_streak", indexerName: "snapshot_prices", latestSuccessMinutesAgo: 70, failureMinutesAgo: [4, 12] },
  ]

  const scenarioIndexerNames = scenarios.map((scenario) => scenario.indexerName)
  const unknownScenarios = scenarioIndexerNames.filter((indexerName) => !configuredIndexerNames.includes(indexerName))
  if (unknownScenarios.length > 0) {
    throw new Error(`Mock scenarios reference unknown configured indexers: ${unknownScenarios.join(", ")}`)
  }

  const deleted = await prisma.$executeRaw`
    DELETE FROM "global"."indexer_execution_log"
    WHERE indexer_name IN (${Prisma.join(scenarioIndexerNames)})
  `

  let inserted = 0
  for (const scenario of scenarios) {
    const points = buildScenarioPoints(scenario, days)
    points.sort((a, b) => a.finishedAt.getTime() - b.finishedAt.getTime())

    for (const point of points) {
      await insertExecution(point)
      inserted++
    }
  }

  console.log("Mocked indexer execution logs")
  console.log(`Window: ${days} day(s)`)
  console.log(`Deleted rows: ${deleted}`)
  console.log(`Inserted rows: ${inserted}`)
  console.log("Scenarios:")
  console.log("  block_indexer: fresh, high volume, one historical failure")
  console.log("  global_data_indexer: warning stale")
  console.log("  liquidation_check: critical failure streak")
  console.log("  liquidation_process: critical stale")
  console.log("  monitoring_check: no data, unknown")
  console.log("  onchain_tx_bot: ok hourly job with one historical failure")
  console.log("  peg_keeper_update: warning stale hourly job")
  console.log("  points_lp_indexer: ok daily job")
  console.log("  points_votes_indexer: critical stale daily job")
  console.log("  snapshot_prices: warning failure streak")
}

main()
  .catch((error) => {
    console.error("Mock indexer executions failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
