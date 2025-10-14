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
      WHERE te."address" = ${address}
        AND ts."timestamp" >= ${from}::timestamptz
        AND ts."timestamp" <=  ${to}::timestamptz
      ORDER BY ts."timestamp" ASC
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
