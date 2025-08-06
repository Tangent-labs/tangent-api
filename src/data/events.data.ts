import { FastifyInstance } from "fastify";
import { isAddress } from "viem";
import { RawEvent, TotalBorrowPoint } from "../types";
import { PrismaClient } from "@prisma/client";

export async function getEventsByAccount(
  fastify: FastifyInstance,
  account: string,
  market: string
): Promise<RawEvent[]> {
  try {
    if (!isAddress(account) || !isAddress(market)) {
      throw new Error("Invalid account or market address");
    }

    const marketResult = await fastify.pg.query<{ id: string }>(
      `
      SELECT id
      FROM events.usg_markets
      WHERE LOWER(contract_address) = LOWER($1)
      `,
      [market]
    );

    if (marketResult.rows.length === 0) {
      throw new Error(`No market found for contract_address: ${market}`);
    }

    const market_id = marketResult.rows[0].id;

    const { rows } = await fastify.pg.query<RawEvent>(
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
    );

    if (rows.length === 0) {
      fastify.log.warn(
        `No events found for account: ${account}, market: ${market} (market_id: ${market_id})`
      );
    }

    return rows;
  } catch (err: any) {
    fastify.log.error("Query error:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
    });
    throw new Error(`Database query failed: ${err.message}`);
  }
}

/**
 *
 * @param prisma help  the query
 * @param range range provided by the frontend
 * @param maxPoints max number of points displayed in the graph
 * @returns
 */
export async function getTotalBorrow(
  prisma: PrismaClient,
  range: string,
  maxPoints: number = 100
): Promise<{ latestTotalDebt: string; data: TotalBorrowPoint[] }> {
  const now = new Date();
  let since: Date;
  let interval: "hour" | "day" | "week" | "month";

  switch (range) {
    case "1w":
      interval = "hour";
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "1m":
      interval = "day";
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "1y":
      interval = "week";
      since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case "all":
    default:
      interval = "month";
      since = new Date("2025-01-01T00:00:00.000Z");
  }

  const chartData = await prisma.$queryRawUnsafe<
    { timestamp: Date; total: number }[]
  >(
    `WITH bucketed AS (
      SELECT *,
            DATE_TRUNC('${interval}', timestamp) AS bucket,
            ROW_NUMBER() OVER (PARTITION BY DATE_TRUNC('${interval}', timestamp), market_id ORDER BY timestamp DESC) AS rn
      FROM global.market_global_data
      WHERE timestamp >= $1
    ),
    latest_per_market AS (
      SELECT bucket, total_debt
      FROM bucketed
      WHERE rn = 1
    ),
    grouped AS (
      SELECT bucket, SUM(total_debt) AS total
      FROM latest_per_market
      GROUP BY bucket
    ),
    row_ratio AS (
      SELECT GREATEST(COUNT(*) / ${maxPoints}, 1) AS ratio FROM grouped
    ),
    numbered AS (
      SELECT bucket, total,
            ROW_NUMBER() OVER (ORDER BY bucket ASC) AS rn
      FROM grouped
    )
    SELECT bucket AS timestamp, total
    FROM numbered, row_ratio
    WHERE (rn - 1) % row_ratio.ratio = 0
    ORDER BY timestamp ASC`,
    since
  );

  const data: TotalBorrowPoint[] = chartData.map((row) => ({
    timestamp: row.timestamp,
    value: Math.round(row.total).toString(),
  }));

  const [latest] = await prisma.$queryRaw<{ timestamp: Date; total: number }[]>`
    SELECT
      MAX("timestamp") AS timestamp,
      SUM("total_debt") AS total
    FROM global.market_global_data
    WHERE timestamp = (SELECT MAX("timestamp") FROM global.market_global_data)
  `;

  return {
    latestTotalDebt: Math.round(latest.total).toString(),
    data,
  };
}
