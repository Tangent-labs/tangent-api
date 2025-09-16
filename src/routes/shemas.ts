import { RouteShorthandOptions } from "fastify"

export const getMarketHistoricalMarketDataSchema: RouteShorthandOptions = {
  schema: {
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

export const userPointsSchema: RouteShorthandOptions = {
  schema: {
    params: {
      type: "object",
      required: ["userAddress", "dateFrom"],
      properties: {
        userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
        dateFrom: { type: "string", format: "date-time" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          totalPoints: { type: "number" },
          basePoints: { type: "number" },
          referralPoints: { type: "number" },
          dailyRate: { type: "number" },
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

export const userTasksSchema: RouteShorthandOptions = {
  schema: {
    params: {
      type: "object",
      properties: {
        userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
      },
      required: ["userAddress"],
    },
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            taskId: { type: "number" },
            asset: { type: "string" },
            url: { type: "string" },
            protocol: { type: "string" },
            description: { type: "string" },
            pointRate: { type: "number" },
            status: { type: "boolean" },
            points: { type: "number" },
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

export const referralSchema: RouteShorthandOptions = {
  schema: {
    body: {
      type: "object",
      required: ["referralCode", "signature", "account", "now"],
      properties: {
        referralCode: {
          type: "string",
          minLength: 8,
          maxLength: 16,
          pattern: "^[a-zA-Z0-9]+$",
        },
        signature: { type: "string", pattern: "^0x[a-fA-F0-9]{130}$" },
        account: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
        now: { type: "string", format: "date-time" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
      400: {
        type: "object",
        properties: {
          error: { type: "string" },
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

export const generateReferralSchema: RouteShorthandOptions = {
  schema: {
    body: {
      type: "object",
      required: ["account"],
      properties: {
        account: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
      400: {
        type: "object",
        properties: {
          error: { type: "string" },
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

export const referralStatusSchema: RouteShorthandOptions = {
  schema: {
    querystring: {
      type: "object",
      required: ["account"],
      properties: {
        account: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          hasGeneratedCode: { type: "boolean" },
          hasUsedCode: { type: "boolean" },
          referralCode: { type: ["string", "null"] },
          friends: { type: "integer" },
        },
      },
      400: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
      404: {
        type: "object",
        properties: {
          error: { type: "string" },
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

const leaderboardItem = {
  type: "object",
  additionalProperties: false,
  properties: {
    rank: { type: "integer" },
    address: { type: "string" },
    pts: { type: "integer" },
  },
  required: ["rank", "address", "pts"],
}

export const leaderboardsSchema: RouteShorthandOptions = {
  schema: {
    response: {
      200: {
        type: "object",
        additionalProperties: false,
        properties: {
          lpLeaderboard: {
            type: "array",
            items: leaderboardItem,
          },
          voteLeaderboard: {
            type: "array",
            items: leaderboardItem,
          },
        },
        required: ["lpLeaderboard", "voteLeaderboard"],
      },
      400: {
        type: "object",
        properties: { error: { type: "string" } },
        additionalProperties: false,
      },
      404: {
        type: "object",
        properties: { error: { type: "string" } },
        additionalProperties: false,
      },
      500: {
        type: "object",
        properties: { error: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
}

const item = {
  type: "object",
  additionalProperties: false,
  properties: {
    rank: { type: "integer" },
    address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
    lpPoints: { type: "integer" },
    votePts: { type: "integer" },
  },
  required: ["rank", "address", "lpPoints", "votePts"],
} as const

export const godsonsLeaderboardSchema: RouteShorthandOptions = {
  schema: {
    params: {
      type: "object",
      properties: {
        address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
      },
      required: ["address"],
    },
    response: {
      200: { type: "array", items: item },
      400: { type: "object", additionalProperties: false, properties: { error: { type: "string" } } },
      500: { type: "object", additionalProperties: false, properties: { error: { type: "string" } } },
    },
  },
}
