import { Prisma, PrismaClient } from "@prisma/client"
import { MarketAPR } from "../types"

export type TokenPoint = { timestamp: Date; amount: string }

export class ProtocolMetricsRepository {
  prismaClient: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prismaClient = prisma
  }

  async getTotalSupply(address: string, from: string, to: string): Promise<{ timestamp: Date; amount: string }[]> {
    const rows = await this.prismaClient.$queryRaw<{ timestamp: Date; amount: string }[]>`
      SELECT
        ts."timestamp" AS timestamp,
        ((ts."total_supply")::numeric / ${BigInt(10 ** 18)}::numeric)::text AS amount
      FROM "global"."total_supplies" ts
      JOIN "points"."tracked_erc20" te
        ON te."id" = ts."token_id"
      WHERE te."address" = LOWER(${address})
        AND ts."timestamp" >= ${from}::timestamptz
        AND ts."timestamp" <=  ${to}::timestamptz
      ORDER BY ts."timestamp" ASC
    `

    return rows
  }

  async getAPRs(): Promise<MarketAPR[]> {
    const rows = await this.prismaClient.$queryRaw<
      Array<{
        contract_name: string
        contract_address: string
        apr_current: Prisma.JsonValue
        apr_projected: Prisma.JsonValue
      }>
    >`
      WITH latest AS (
        SELECT
          g."market_id",
          g."timestamp",
          g."apr_current",
          g."apr_projected",
          ROW_NUMBER() OVER (PARTITION BY g."market_id" ORDER BY g."timestamp" DESC) AS rn
        FROM "global"."market_global_data" g
      )
      SELECT
        m."contract_name",
        m."contract_address",
        l."timestamp",
        l."apr_current",
        l."apr_projected"
      FROM latest l
      JOIN "events"."usg_markets" m
        ON m."id" = l."market_id"
      WHERE l.rn = 1
      ORDER BY m."id" ASC
    `

    return rows.map((r) => ({
      currentAPR: (r.apr_current ?? {}) as unknown as Record<string, number>,
      projectedAPR: (r.apr_projected ?? {}) as unknown as Record<string, number>,
      marketAddress: r.contract_address.toLowerCase(),
      marketName: r.contract_name,
    }))
  }
}
