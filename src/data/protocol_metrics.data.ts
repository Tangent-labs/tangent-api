import { Prisma, PrismaClient } from "@prisma/client"
import { MarketAPR } from "../types"

export type TokenPoint = { timestamp: Date; amount: string }

export class ProtocolMetricsRepository {
  prismaClient: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prismaClient = prisma
  }

  async getTotalSupply(address: string, fromISO: string | null, toISO: string, targetPoints: number): Promise<{ timestamp: Date; amount: string }[]> {
    const rows = await this.prismaClient.$queryRaw<{ timestamp: Date; amount: string }[]>`
    WITH token AS (
      SELECT te."id" AS token_id
      FROM "points"."tracked_erc20" te
      WHERE te."address" = ${address.toLowerCase()}
      LIMIT 1
    ),
    filtered AS (
      SELECT
        ts."timestamp" AS timestamp,
        (ts."total_supply")::numeric / ${BigInt(10 ** 18)}::numeric AS amount
      FROM "global"."total_supplies" ts
      JOIN token ON token.token_id = ts."token_id"
      WHERE ts."timestamp" >= COALESCE(
              ${fromISO}::timestamptz,
              (SELECT MIN(ts2."timestamp") FROM "global"."total_supplies" ts2 JOIN token t2 ON t2.token_id = ts2."token_id")
            )
        AND ts."timestamp" <= ${toISO}::timestamptz
    ),
    row_ratio AS (
      SELECT GREATEST(CEIL(COUNT(*)::numeric / ${targetPoints}::numeric), 1)::int AS ratio
      FROM filtered
    ),
    ranked AS (
      SELECT
        f.timestamp,
        f.amount,
        ROW_NUMBER() OVER (ORDER BY f.timestamp DESC) AS rn
      FROM filtered f
    )
    SELECT
      r.timestamp,
      (r.amount)::text AS amount
    FROM ranked r, row_ratio rr
    WHERE (r.rn - 1) % rr.ratio = 0
    ORDER BY r.timestamp ASC;
  `

    return rows
  }

  async getLastMarketAprs(): Promise<MarketAPR[]> {
    const rows = await this.prismaClient.$queryRaw<
      Array<{
        contract_name: string
        contract_address: string
        apr_current: Prisma.JsonValue
        apr_projected: Prisma.JsonValue
      }>
    >`
      SELECT
        m."contract_name",
        m."contract_address",
        l."timestamp",
        l."apr_current",
        l."apr_projected"
      FROM "events"."usg_markets" m
      JOIN "global"."latest_global_data" l ON l."market_id" = m."id"
     `

    return rows.map((r) => ({
      currentAPR: (r.apr_current ?? {}) as unknown as Record<string, number>,
      projectedAPR: (r.apr_projected ?? {}) as unknown as Record<string, number>,
      marketAddress: r.contract_address.toLowerCase(),
      marketName: r.contract_name,
    }))
  }
}
