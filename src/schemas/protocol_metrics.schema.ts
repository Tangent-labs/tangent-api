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

export const activePositionsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Protocol metrics"],
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            contractName: { type: "string" },
            contractAddress: { type: "string" },
            borrowerAddress: { type: "string" },
            debtShares: { type: "string" },
          },
          required: ["contractName", "contractAddress", "borrowerAddress", "debtShares"],
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
            date: { type: "string", format: "date-time" },
            total: { type: "number" },
            markets: { type: "number" },
            wts: { type: "number" },
            pegkeepers: { type: "number" },
            susg: { type: "number" },
          },
          required: ["date", "total", "markets", "wts", "pegkeepers", "susg"],
        },
      },
    },
  },
}

export const revenuesSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Protocol metrics"],
    params: {
      type: "object",
      additionalProperties: false,
      required: ["range"],
      properties: {
        range: { type: "string", enum: ["day", "week", "month"] },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          revenues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                period: { type: "string" },
                ir: { type: "number" },
                reward: { type: "number" },
                total: { type: "number" },
              },
              required: ["period", "ir", "reward", "total"],
            },
          },
          total: { type: "number" },
        },
        required: ["revenues", "total"],
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

export const pricesSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Protocol metrics"],
    params: {
      type: "object",
      required: ["tokenAddresses"],
      properties: {
        tokenAddresses: {
          type: "string",
          pattern: "^0x[a-fA-F0-9]{40}(,0x[a-fA-F0-9]{40})*$",
          description: "One or more token addresses separated by commas.",
        },
      },
    },
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            priceUSD: { type: ["string", "null"] },
          },
          required: ["tokenAddress", "priceUSD"],
        },
      },
    },
  },
}

export const priceHistorySchema: RouteShorthandOptions = {
  schema: {
    tags: ["Protocol metrics"],
    params: {
      type: "object",
      required: ["tokenAddresses"],
      properties: {
        tokenAddresses: {
          type: "string",
          pattern: "^0x[a-fA-F0-9]{40}(,0x[a-fA-F0-9]{40})*$",
          description: "One to five token addresses separated by commas.",
        },
      },
    },
    querystring: {
      type: "object",
      additionalProperties: false,
      required: ["range"],
      properties: {
        range: { type: "string", enum: ["1d", "1w", "1m", "1y", "all"] },
      },
    },
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tokenAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            history: {
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
          required: ["tokenAddress", "history"],
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

export const getOracleMarketDataSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Protocol metrics"],
    params: {
      type: "object",
      additionalProperties: false,
      required: ["marketAddress"],
      properties: {
        marketAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
      },
    },
    querystring: {
      type: "object",
      additionalProperties: false,
      required: ["bucketCount", "bucketSizeMinutes"],
      properties: {
        dateEnd: { type: "string", format: "date-time" },
        bucketCount: { type: "integer", minimum: 1, maximum: 300 },
        bucketSizeMinutes: { type: "integer", minimum: 1, maximum: 10080 },
      },
    },
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["ts", "price"],
          properties: {
            ts: { type: "number" },
            price: { type: ["number", "null"] },
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

export const positionsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Protocol metrics"],
    params: {
      type: "object",
      properties: {
        marketAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
      },
      required: ["marketAddress"],
    },
    querystring: {
      type: "object",
      properties: {
        pageSize: { type: "string" },
        offset: { type: "string" },
        userAddress: {
          type: "string",
          pattern: "^0x[a-fA-F0-9]{40}$",
        },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          data: {
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
          total: { type: "integer" },
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
