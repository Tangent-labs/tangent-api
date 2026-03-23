import { RouteShorthandOptions } from "fastify"

const taskItem = {
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
} as const

export const tasksSchema: RouteShorthandOptions = {
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
        type: "object",
        properties: {
          lp: { type: "array", items: taskItem },
          vote: { type: "array", items: taskItem },
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

export const pointsDetailsSchema: RouteShorthandOptions = {
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
          boost: {
            type: "object",
            properties: {
              multiplicator: { type: "string" },
              keys: { type: "array", items: { type: "string" } },
            },
          },
          lp: {
            type: "object",
            properties: {
              total: { type: "string" },
              referees: { type: "string" },
              dailyRate: { type: "string" },
            },
          },
          vote: {
            type: "object",
            properties: {
              total: { type: "string" },
              referees: { type: "string" },
            },
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

const leaderboardItem = {
  type: "object",
  additionalProperties: false,
  properties: {
    rank: { type: "integer" },
    address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
    pts: { type: "integer" },
  },
  required: ["rank", "address", "pts"],
} as const

const godsonsItem = {
  type: "object",
  additionalProperties: false,
  properties: {
    rank: { type: "integer" },
    address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
    pts: { type: "integer" },
  },
  required: ["rank", "address", "pts"],
} as const
const errorResponse = {
  type: "object",
  properties: { error: { type: "string" } },
  additionalProperties: false,
} as const

export const leaderboardsSchema: RouteShorthandOptions = {
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
        additionalProperties: false,
        properties: {
          lp: { type: "array", items: leaderboardItem },
          vote: { type: "array", items: leaderboardItem },
          godsons: { type: "array", items: godsonsItem },
        },
        required: ["lp", "vote", "godsons"],
      },
      400: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
  },
}
