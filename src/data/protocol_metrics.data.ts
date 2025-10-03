import { PrismaClient } from "@prisma/client"

export type TokenPoint = { timestamp: Date; amount: string }

export class ProtocolMetricsRepository {
  prismaClient: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prismaClient = prisma
  }

  async getTotalSupply(address: string, from: string, to: string): Promise<{ timestamp: Date; amount: string }[]> {
    const pow10 = BigInt(10) ** BigInt(18)

    const rows = await this.prismaClient.$queryRaw<{ timestamp: Date; amount: string }[]>`
      SELECT
        ts."timestamp" AS timestamp,
        ((ts."total_supply")::numeric / ${pow10}::numeric)::text AS amount
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
}
