import { RouteShorthandOptions } from "fastify"
import { ALLOWED_IMAGE_MIMES, MAX_BANNERS } from "../services/feature_banner.service.js"

const errorResponse = {
  type: "object",
  properties: {
    error: { type: "string" },
  },
}

export const listFeatureBannersSchema: RouteShorthandOptions = {
  schema: {
    tags: ["FeatureBanner"],
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slot: { type: "integer" },
            text: { type: "string" },
            link: { type: "string" },
            imageUrl: { type: "string" },
            updatedAt: { type: "string" },
          },
        },
      },
      500: errorResponse,
    },
  },
}

export const featureBannerImageSchema: RouteShorthandOptions = {
  schema: {
    tags: ["FeatureBanner"],
    params: {
      type: "object",
      required: ["slot"],
      properties: {
        slot: { type: "integer", minimum: 1, maximum: MAX_BANNERS },
      },
    },
  },
}

export const replaceFeatureBannersSchema: RouteShorthandOptions = {
  // Base64 images make for a body well past Fastify's 1MB default.
  bodyLimit: 8 * 1024 * 1024,
  schema: {
    tags: ["FeatureBanner"],
    body: {
      type: "object",
      required: ["banners"],
      properties: {
        banners: {
          type: "array",
          maxItems: MAX_BANNERS,
          items: {
            type: "object",
            required: ["slot", "text", "link", "image", "imageMime"],
            properties: {
              slot: { type: "integer", minimum: 1, maximum: MAX_BANNERS },
              text: { type: "string", minLength: 1, maxLength: 80 },
              link: { type: "string", minLength: 1, maxLength: 2048 },
              image: { type: "string", minLength: 1 },
              imageMime: { type: "string", enum: ALLOWED_IMAGE_MIMES },
            },
          },
        },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          count: { type: "integer" },
        },
      },
      400: errorResponse,
      401: errorResponse,
      500: errorResponse,
    },
  },
}
