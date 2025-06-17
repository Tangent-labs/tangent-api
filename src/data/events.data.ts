import { FastifyInstance } from "fastify";
import { isAddress } from "viem";

export interface RawEvent {
  label: string;
  collat_amount: string;
  usg_amount: string;
  date: string;
  tx_hash: string;
}

export async function getEventsByAccount(
  fastify: FastifyInstance,
  account: string,
  market: string
): Promise<RawEvent[]> {
  try {
    if (!isAddress(account) || !isAddress(market)) {
      throw new Error("Bad Request");
    }

    const { rows } = await fastify.pg.query<RawEvent>(
      `
      SELECT 'market_borrow' AS label, '0' AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM market_borrow
      WHERE LOWER(account) = LOWER($1) AND LOWER(market) = LOWER($2)
      UNION ALL
      SELECT 'market_deposit' AS label, staked_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
      FROM market_deposit
      WHERE LOWER(account) = LOWER($1) AND LOWER(market) = LOWER($2)
      UNION ALL
      SELECT 'market_zap_deposit' AS label, staked_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
      FROM market_zap_deposit
      WHERE LOWER(account) = LOWER($1) AND LOWER(market) = LOWER($2)
      UNION ALL
      SELECT 'market_deposit_and_borrow' AS label, staked_amount AS collat_amount, borrow_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM market_deposit_and_borrow
      WHERE LOWER(account) = LOWER($1) AND LOWER(market) = LOWER($2)
      UNION ALL
      SELECT 'market_zap_deposit_and_borrow' AS label, staked_amount AS collat_amount, borrow_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM market_zap_deposit_and_borrow
      WHERE LOWER(account) = LOWER($1) AND LOWER(market) = LOWER($2)
      UNION ALL
      SELECT 'market_withdraw' AS label, withdrawn_amount AS collat_amount, '0' AS usg_amount, block_date::text AS date, tx_hash
      FROM market_withdraw
      WHERE LOWER(account) = LOWER($1) AND LOWER(market) = LOWER($2)
      UNION ALL
      SELECT 'market_repay' AS label, '0' AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM market_repay
      WHERE LOWER(account) = LOWER($1) AND LOWER(market) = LOWER($2)
      UNION ALL
      SELECT 'market_repay_and_withdraw' AS label, withdrawn_amount AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM market_repay_and_withdraw
      WHERE LOWER(account) = LOWER($1) AND LOWER(market) = LOWER($2)
      UNION ALL
      SELECT 'market_zap_repay' AS label, '0' AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM market_zap_repay
      WHERE LOWER(account) = LOWER($1) AND LOWER(market) = LOWER($2)
      UNION ALL
      SELECT 'market_zap_repay_and_withdraw' AS label, withdrawn_amount AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM market_zap_repay_and_withdraw
      WHERE LOWER(account) = LOWER($1) AND LOWER(market) = LOWER($2)
      UNION ALL
      SELECT 'market_leverage' AS label, staked_amount AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM market_leverage
      WHERE LOWER(account) = LOWER($1) AND LOWER(market) = LOWER($2)
      UNION ALL
      SELECT 'market_zap_leverage' AS label, staked_amount AS collat_amount, borrowed_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM market_zap_leverage
      UNION ALL
      SELECT 'market_liquidate' AS label, collateral_liquidated AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM market_liquidate
      UNION ALL
      SELECT 'market_self_liquidate' AS label, collateral_liquidated AS collat_amount, repaid_amount AS usg_amount, block_date::text AS date, tx_hash
      FROM market_self_liquidate
      WHERE LOWER(account) = LOWER($1) AND LOWER(market) = LOWER($2)
      ORDER BY date DESC
      `,
      [account, market]
    );

    if (rows.length === 0) {
      fastify.log.warn(
        `No events found for account: ${account}, market: ${market}`
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
