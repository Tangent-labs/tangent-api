import { FastifyInstance } from "fastify";

// Interface for raw event data from the database
export interface RawEvent {
  label: string;
  amount: string;
  usg_amount: string;
  date: string;
  market: string;
}

// Data layer function to fetch events for an account
export async function getEventsByAccount(
  fastify: FastifyInstance,
  account: string
): Promise<RawEvent[]> {
  try {
    const { rows } = await fastify.pg.query<RawEvent>(
      `
      SELECT 'market_borrow' AS label, '0' AS amount, borrowed_amount AS usg_amount, block_date::text AS date, market
      FROM market_borrow
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_deposit' AS label, staked_amount AS amount, '0' AS usg_amount, block_date::text AS date, market
      FROM market_deposit
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_zap_deposit' AS label, staked_amount AS amount, '0' AS usg_amount, block_date::text AS date, market
      FROM market_zap_deposit
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_deposit_and_borrow' AS label, staked_amount AS amount, borrow_amount AS usg_amount, block_date::text AS date, market
      FROM market_deposit_and_borrow
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_zap_deposit_and_borrow' AS label, staked_amount AS amount, borrow_amount AS usg_amount, block_date::text AS date, market
      FROM market_zap_deposit_and_borrow
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_withdraw' AS label, withdrawn_amount AS amount, '0' AS usg_amount, block_date::text AS date, market
      FROM market_withdraw
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_repay' AS label, '0' AS amount, repaid_amount AS usg_amount, block_date::text AS date, market
      FROM market_repay
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_repay_and_withdraw' AS label, withdrawn_amount AS amount, repaid_amount AS usg_amount, block_date::text AS date, market
      FROM market_repay_and_withdraw
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_zap_repay' AS label, '0' AS amount, repaid_amount AS usg_amount, block_date::text AS date, market
      FROM market_zap_repay
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_zap_repay_and_withdraw' AS label, withdrawn_amount AS amount, repaid_amount AS usg_amount, block_date::text AS date, market
      FROM market_zap_repay_and_withdraw
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_leverage' AS label, staked_amount AS amount, borrowed_amount AS usg_amount, block_date::text AS date, market
      FROM market_leverage
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_zap_leverage' AS label, staked_amount AS amount, borrowed_amount AS usg_amount, block_date::text AS date, market
      FROM market_zap_leverage
      WHERE LOWER(account) = LOWER($1)
      ORDER BY date DESC
      `,
      [account]
    );
    return rows;
  } catch (err) {
    fastify.log.error(err);
    throw new Error("Database query failed");
  }
}
