import { RouteShorthandOptions } from "fastify"

const erc20 = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    address: { type: "string" },
    decimals: { type: "integer" },
  },
  required: ["name", "address", "decimals"],
}

export const predepositFrontSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Predeposit"],
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
          predepositState: { type: "string" },
          userState: { type: "string" },
          isSigned: { type: "boolean" },
          lpData: {
            type: "array",
            items: {
              type: "object",
              properties: {
                accumulatedBalance: { type: "string" },
                accumulatedTotal: { type: "string" },
                cap: { type: "string" },
                lpName: { type: "string" },
                otherStable: erc20,
              },
            },
          },
        },
      },
    },
  },
}

export const signPredepositSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Predeposit"],
    body: {
      type: "object",
      required: ["signature", "account", "now"],
      properties: {
        signature: { type: "string", pattern: "^0x[a-fA-F0-9]+$" },
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
