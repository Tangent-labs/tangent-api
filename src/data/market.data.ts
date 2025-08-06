import { FastifyInstance } from "fastify"

export type Aprs = { current: { [key: string]: number }; projected: { [key: string]: number }; contract_address: string }

export async function getLastAprs(fastify: FastifyInstance): Promise<Aprs[]> {
  const { rows } = await fastify.pg.query(
    `SELECT b.contract_address as contract_address, a.apr_current as current, a.apr_projected as projected FROM market_global_data a 
      JOIN market_contracts b 
      ON a.market_id = b.id
      WHERE a."timestamp" = 
      (SELECT MAX("timestamp") from market_global_data);`
  )

  return rows
}
