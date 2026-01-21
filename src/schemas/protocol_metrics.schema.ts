import { RouteShorthandOptions } from "fastify"

export const aprsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Protocol metrics"],
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            currentAPR: {
              type: "object",
              additionalProperties: { type: "number" },
            },
            projectedAPR: {
              type: "object",
              additionalProperties: { type: "number" },
            },
            marketAddress: { type: "string" },
            marketName: { type: "string" },
          },
          required: ["currentAPR", "projectedAPR", "marketAddress", "marketName"],
        },
      },
    },
  },
}

export const savingAccountsApySchema: RouteShorthandOptions = {
  schema: {
    tags: ["Protocol metrics"],
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timestamp: { type: "string", format: "date-time" },
            key: { type: "string" },
            tokenAddress: { type: "string" },
            value: { type: "number" },
          },
          required: ["timestamp", "key", "tokenAddress", "value"],
        },
      },
      500: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
}

export const susgHistoricalDataSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Protocol metrics"],
    params: {
      type: "object",
      required: ["dateTo", "dateFrom"],
      properties: {
        dateTo: { type: "number" },
        dateFrom: { type: ["string", "number"] },
      },
    },
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timestamp: { type: "string", format: "date-time" },
            amount: { type: "string" },
          },
          required: ["timestamp", "amount"],
        },
      },
    },
  },
}

export const tvlSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Protocol metrics"],
    params: {
      type: "object",
      required: ["dateTo", "dateFrom"],
      properties: {
        dateTo: { type: "number" },
        dateFrom: { type: ["string", "number"] },
      },
    },
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timestamp: { type: "string", format: "date-time" },
            markets: { type: "string" },
            wts: { type: "string" },
            pegKeepers: { type: "string" },
            susg: { type: "string" },
          },
          required: ["timestamp", "markets", "wts", "pegKeepers", "susg"],
        },
      },
    },
  },
}

export const totalSupplySchema: RouteShorthandOptions = {
  schema: {
    tags: ["Protocol metrics"],
    params: {
      type: "object",
      required: ["dateTo", "dateFrom", "tokenAddress"],
      properties: {
        dateTo: { type: "number" },
        dateFrom: { type: ["string", "number"] },
        tokenAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
      },
    },
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timestamp: { type: "string", format: "date-time" },
            amount: { type: "string" },
          },
          required: ["timestamp", "amount"],
        },
      },
    },
  },
}

export const getMarketHistoricalMarketDataSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Protocol metrics"],
    params: {
      type: "object",
      additionalProperties: false,
      required: ["marketAddress", "dateFrom"],
      properties: {
        marketAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
        dateFrom: { type: "string", format: "date-time" },
      },
    },
    querystring: {
      type: "object",
      additionalProperties: false,
      properties: {
        range: { type: "string", enum: ["1w", "1m", "1y", "all"], default: "all" },
      },
    },
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["timestamp", "tvl_usd", "total_debt", "ir_apy", "apr_current"],
          properties: {
            timestamp: { type: "string", format: "date-time" },
            tvl_usd: { type: "number" },
            total_debt: { type: "number" },
            ir_apy: { type: "number" },
            apr_current: { type: "string" },
          },
        },
      },
      500: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
}

export const eventsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Protocol metrics"],
    params: {
      type: "object",
      properties: {
        account: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
        market: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
      },
      required: ["account", "market"],
    },
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            collatAmount: { type: "string" },
            usgAmount: { type: "string" },
            date: { type: "string", format: "date-time" },
            txHash: { type: "string" },
          },
        },
      },
      500: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
}
