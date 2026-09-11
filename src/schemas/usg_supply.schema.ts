import { RouteShorthandOptions } from "fastify"

// Coingecko's /api/v3/supply/eth answers {"result":"<decimal string>"}. The amount
// stays a string so an 18-decimal value is not rounded by a JSON float.
const resultResponse = {
  200: {
    type: "object",
    properties: { result: { type: "string" } },
    required: ["result"],
  },
}

export const usgTotalSupplySchema: RouteShorthandOptions = {
  schema: {
    tags: ["USG"],
    description: 'USG total supply, decimal-adjusted, as {"result":"<amount>"}.',
    response: resultResponse,
  },
}

export const usgCirculatingSupplySchema: RouteShorthandOptions = {
  schema: {
    tags: ["USG"],
    description: 'USG circulating supply (total supply minus pegkeeper balances), decimal-adjusted, as {"result":"<amount>"}.',
    response: resultResponse,
  },
}

// CMC wants the bare number. No `response` schema on purpose: declaring one makes
// Fastify serialize the body as JSON, which would quote the number.
export const usgTotalSupplyPlainSchema: RouteShorthandOptions = {
  schema: {
    tags: ["USG"],
    description: "USG total supply, decimal-adjusted, as a bare text/plain number.",
    produces: ["text/plain"],
  },
}

export const usgCirculatingSupplyPlainSchema: RouteShorthandOptions = {
  schema: {
    tags: ["USG"],
    description: "USG circulating supply (total supply minus pegkeeper balances), decimal-adjusted, as a bare text/plain number.",
    produces: ["text/plain"],
  },
}
