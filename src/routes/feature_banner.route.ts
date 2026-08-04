import { FastifyInstance, FastifyRequest } from "fastify"
import { FeatureBannerService, FeatureBannerUpload } from "../services/feature_banner.service.js"
import { listFeatureBannersSchema, featureBannerImageSchema, replaceFeatureBannersSchema } from "../schemas/feature_banner.schema.js"
import { secretTokenPreHandler } from "../middleware/auth.js"
import { toError, UserError } from "../utils.js"

interface ReplaceFeatureBanners {
  Body: { banners: FeatureBannerUpload[] }
}

export async function registerFeatureBannerRoutes(fastify: FastifyInstance, opts: { featureBannerService: FeatureBannerService }) {
  // Public: what the dApp carousel should display, image bytes excluded.
  fastify.get("/feature-banners", listFeatureBannersSchema, async (request, reply) => {
    try {
      const banners = await opts.featureBannerService.list()
      return reply.status(200).send(banners)
    } catch (err) {
      const errTyped = toError(err)
      request.log.error(`Error listing feature banners: ${err}`)
      return reply.status(500).send({ error: errTyped.message })
    }
  })

  // Public: the image itself.
  fastify.get("/feature-banners/:slot/image", featureBannerImageSchema, async (request, reply) => {
    const { slot } = request.params as { slot: number }
    try {
      const banner = await opts.featureBannerService.getImage(slot)
      if (!banner) {
        return reply.status(404).send({ error: `No banner in slot ${slot}` })
      }

      // The listing hands out a ?v= stamped URL, so those can be cached hard.
      // Bare requests get revalidated instead, in case a banner was replaced.
      const versioned = "v" in (request.query as Record<string, unknown>)

      return reply
        .header("Content-Type", banner.image_mime)
        .header("Content-Disposition", "inline")
        .header("X-Content-Type-Options", "nosniff")
        .header("Cache-Control", versioned ? "public, max-age=31536000, immutable" : "public, max-age=60")
        .header("ETag", `"${slot}-${banner.updated_at.getTime()}"`)
        .status(200)
        .send(Buffer.from(banner.image))
    } catch (err) {
      const errTyped = toError(err)
      request.log.error(`Error retrieving feature banner image for slot ${slot}: ${err}`)
      return reply.status(err instanceof UserError ? 400 : 500).send({ error: errTyped.message })
    }
  })

  // Private: replaces every banner at once, driven by the Jessika form.
  fastify.post<ReplaceFeatureBanners>("/feature-banners", {
    ...replaceFeatureBannersSchema,
    preHandler: secretTokenPreHandler,
    handler: async (request: FastifyRequest<ReplaceFeatureBanners>, reply) => {
      try {
        const count = await opts.featureBannerService.replaceAll(request.body.banners)
        return reply.status(200).send({ ok: true, count })
      } catch (err) {
        const errTyped = toError(err)
        request.log.error(`Error replacing feature banners: ${err}`)
        return reply.status(err instanceof UserError ? 400 : 500).send({ error: errTyped.message })
      }
    },
  })
}
