import { RouteShorthandOptions } from "fastify"

export const referralSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Referral"],
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
    tags: ["Referral"],
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
    tags: ["Referral"],
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
