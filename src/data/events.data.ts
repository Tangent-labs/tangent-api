import { FastifyInstance } from "fastify";

// Interface for raw event data from the database
export interface RawEvent {
  label: string;
  amount: string;
  date: string; // Raw block_date as string
}

// Data layer function to fetch events for an account
export async function getEventsByAccount(
  fastify: FastifyInstance,
  account: string
): Promise<RawEvent[]> {
  try {
    const { rows } = await fastify.pg.query<RawEvent>(
      `
      SELECT 'market_borrower' AS label, '' AS amount, block_date::text AS date
      FROM market_borrower
      WHERE LOWER(borrower_address) = LOWER($1)
      UNION ALL
      SELECT 'market_borrow' AS label, borrowed_amount AS amount, block_date::text AS date
      FROM market_borrow
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_deposit' AS label, staked_amount AS amount, block_date::text AS date
      FROM market_deposit
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_zap_deposit' AS label, staked_amount AS amount, block_date::text AS date
      FROM market_zap_deposit
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_deposit_and_borrow' AS label, staked_amount AS amount, block_date::text AS date
      FROM market_deposit_and_borrow
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_zap_deposit_and_borrow' AS label, staked_amount AS amount, block_date::text AS date
      FROM market_zap_deposit_and_borrow
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_withdraw' AS label, withdrawn_amount AS amount, block_date::text AS date
      FROM market_withdraw
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_repay' AS label, repaid_amount AS amount, block_date::text AS date
      FROM market_repay
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_repay_and_withdraw' AS label, withdrawn_amount AS amount, block_date::text AS date
      FROM market_repay_and_withdraw
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_zap_repay' AS label, repaid_amount AS amount, block_date::text AS date
      FROM market_zap_repay
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_zap_repay_and_withdraw' AS label, withdrawn_amount AS amount, block_date::text AS date
      FROM market_zap_repay_and_withdraw
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_leverage' AS label, staked_amount AS amount, block_date::text AS date
      FROM market_leverage
      WHERE LOWER(account) = LOWER($1)
      UNION ALL
      SELECT 'market_zap_leverage' AS label, staked_amount AS amount, block_date::text AS date
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
