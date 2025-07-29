import { RouteShorthandOptions } from "fastify";

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
};

export const referralSchema: RouteShorthandOptions = {
  schema: {
    body: {
      type: "object",
      required: ["referralCode", "signature", "account"],
      properties: {
        referralCode: {
          type: "string",
          minLength: 8,
          maxLength: 16,
          pattern: "^[a-zA-Z0-9]+$",
        },
        signature: { type: "string", pattern: "^0x[a-fA-F0-9]{130}$" },
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
};

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
};

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
          hasUsedCode: { type: "boolean" },
          referralCode: { type: ["string", "null"] },
          friends: { type: "number" },
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
};
