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
