import { RouteShorthandOptions } from "fastify"

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
    tags: ["Points program"],
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
    tags: ["Points program"],
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

export const boostsPointsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Points program"],
    params: {
      type: "object",
      required: ["userAddress"],
      properties: {
        userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
      },
    },
    response: {
      200: {
        type: "object",
        required: ["result", "boost"],
        properties: {
          result: {
            type: "array",
            items: { type: "string" },
          },
          boost: {
            type: "number",
          },
        },
      },
      500: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
        required: ["error"],
      },
    },
  },
}

export const lpPointsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Points program"],
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
          lpTotalPoints: { type: "number" },
          lpDailyRate: { type: "number" },
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

export const refereesPointsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Points program"],
    params: {
      type: "object",
      required: ["userAddress"],
      properties: {
        userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          lpPoints: { type: "number" },
          votePoints: { type: "number" },
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
    tags: ["Points program"],
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
            organisation: { type: "string" },
            pointRate: { type: "number" },
            lastVotingPower: { type: "number" },
            status: { type: "boolean" },
            points: { type: "number" },
            tokenAddress: { type: "string" },
            priceUSD: { type: "string" },
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

export const votePointsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Points program"],
    params: {
      type: "object",
      required: ["userAddress"],
      properties: {
        userAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          voteTotalPoints: { type: "number" },
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
