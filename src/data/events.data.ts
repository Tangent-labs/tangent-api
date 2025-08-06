import { FastifyInstance } from "fastify"
import { isAddress } from "viem"
import { RawEvent, TotalBorrowPoint } from "../types"
import { AddressLike } from "ethers"
export class EventRepository {
  fastify: FastifyInstance

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify
  }

  async getEventsByAccount(account: string, market: string): Promise<RawEvent[]> {
    try {
      if (!isAddress(account) || !isAddress(market)) {
        throw new Error("Invalid account or market address")
      }

      const marketResult = await this.fastify.pg.query<{ id: string }>(
        `
      SELECT id
      FROM events.usg_markets
      WHERE LOWER(contract_address) = LOWER($1)
      `,
        [market]
      )

      if (marketResult.rows.length === 0) {
        throw new Error(`No market found for contract_address: ${market}`)
      }

      const market_id = marketResult.rows[0].id

      const { rows } = await this.fastify.pg.query<RawEvent>(
        `
      SELECT 'borrow' AS label, '0' AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.borrow
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'deposit' AS label, staked_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
      FROM events.deposit
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'zap_deposit' AS label, staked_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_deposit
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'deposit_and_borrow' AS label, staked_amount AS collat_amount, borrow_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.deposit_and_borrow
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'zap_deposit_and_borrow' AS label, staked_amount AS collat_amount, borrow_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_deposit_and_borrow
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'withdraw' AS label, withdrawn_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
      FROM events.withdraw
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'repay' AS label, '0' AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.repay
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'repay_and_withdraw' AS label, withdrawn_amount AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.repay_and_withdraw
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'zap_repay' AS label, '0' AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_repay
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'zap_repay_and_withdraw' AS label, withdrawn_amount AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_repay_and_withdraw
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'leverage' AS label, staked_amount AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.leverage
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'zap_leverage' AS label, staked_amount AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.zap_leverage
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'liquidate' AS label, collateral_liquidated AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.liquidate
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      UNION ALL
      SELECT 'self_liquidate' AS label, collateral_liquidated AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM events.self_liquidate
      WHERE LOWER(account) = LOWER($1) AND market_id = $2
      ORDER BY date DESC
      `,
        [account, market_id]
      )

      if (rows.length === 0) {
        this.fastify.log.warn(`No events found for account: ${account}, market: ${market} (market_id: ${market_id})`)
      }

      return rows
    } catch (err: any) {
      this.fastify.log.error("Query error:", {
        message: err.message,
        stack: err.stack,
        code: err.code,
        detail: err.detail,
        hint: err.hint,
      })
      throw new Error(`Database query failed: ${err.message}`)
    }
  }

  /**
   *
   * @param prisma help  the query
   * @param range range provided by the frontend
   * @param maxPoints max number of points displayed in the graph
   * @returns
   */
  async getHistoricalData(marketAddress: AddressLike, minDate: Date, rowAmounts: number = 100) {
    const query = `WITH filtered_data AS (
    SELECT mgd.id, mgd.timestamp, mgd.tvl_usd, mgd.total_debt, mgd.ir_apy, um.contract_address, mgd.apr_current
    FROM global.market_global_data as mgd
    JOIN events.usg_markets as um ON mgd.market_id = um.id
    WHERE mgd.timestamp > '${minDate}'
    AND um.contract_address = '${marketAddress}'
),
    row_ratio AS (
        SELECT CEIL(COUNT(*) / ${rowAmounts}) AS ratio 
        FROM filtered_data
    )
    SELECT timestamp, tvl_usd, total_debt, ir_apy, apr_current
    FROM (
        SELECT id, timestamp, tvl_usd, total_debt, ir_apy, apr_current,
              ROW_NUMBER() OVER (ORDER BY id DESC) AS rn
        FROM filtered_data
    ) x
      CROSS JOIN row_ratio
    ORDER BY id ASC;`

    const chartData = await this.fastify.prisma.$queryRawUnsafe<any[]>(query, marketAddress, minDate, rowAmounts)

    return chartData
  }
}
