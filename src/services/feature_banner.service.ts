import { FeatureBannerRepository, FeatureBannerInput } from "../data/feature_banner.data.js"
import { UserError } from "../utils.js"

export const MAX_BANNERS = 3
export const MAX_IMAGE_BYTES = 1024 * 1024
export const ALLOWED_IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"]

export interface FeatureBannerUpload {
  slot: number
  text: string
  link: string
  image: string
  imageMime: string
}

export interface FeatureBannerMeta {
  slot: number
  text: string
  link: string
  imageUrl: string
  updatedAt: string
}

export class FeatureBannerService {
  constructor(private repo: FeatureBannerRepository) {}

  async list(): Promise<FeatureBannerMeta[]> {
    const banners = await this.repo.findAllMeta()

    return banners.map((banner) => ({
      slot: banner.slot,
      text: banner.text,
      link: banner.link,
      // Versioned so a replaced image busts any cache the previous one earned.
      imageUrl: `/feature-banners/${banner.slot}/image?v=${banner.updated_at.getTime()}`,
      updatedAt: banner.updated_at.toISOString(),
    }))
  }

  async getImage(slot: number) {
    if (!Number.isInteger(slot) || slot < 1 || slot > MAX_BANNERS) {
      throw new UserError(`Invalid slot ${slot}`)
    }

    return this.repo.findImage(slot)
  }

  async replaceAll(banners: FeatureBannerUpload[]) {
    if (banners.length > MAX_BANNERS) {
      throw new UserError(`Invalid payload: at most ${MAX_BANNERS} banners are allowed, received ${banners.length}`)
    }

    const seen = new Set<number>()
    const rows: FeatureBannerInput[] = banners.map((banner) => {
      if (!Number.isInteger(banner.slot) || banner.slot < 1 || banner.slot > MAX_BANNERS) {
        throw new UserError(`Invalid slot ${banner.slot}: must be between 1 and ${MAX_BANNERS}`)
      }
      if (seen.has(banner.slot)) {
        throw new UserError(`Invalid payload: duplicate slot ${banner.slot}`)
      }
      seen.add(banner.slot)

      return {
        slot: banner.slot,
        text: banner.text.trim(),
        link: parseLink(banner.link),
        // Copied out of Buffer's shared pool so it types as plain bytes for Prisma.
        image: new Uint8Array(decodeImage(banner.image, banner.imageMime)),
        image_mime: banner.imageMime,
      }
    })

    await this.repo.replaceAll(rows)

    return rows.length
  }
}

function parseLink(link: string): string {
  let parsed: URL
  try {
    parsed = new URL(link.trim())
  } catch {
    throw new UserError(`Invalid link ${link}: must be an absolute URL`)
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UserError(`Invalid link ${link}: only http and https are allowed`)
  }

  return parsed.toString()
}

function decodeImage(base64: string, mime: string): Buffer {
  if (!ALLOWED_IMAGE_MIMES.includes(mime)) {
    throw new UserError(`Invalid image type ${mime}: allowed types are ${ALLOWED_IMAGE_MIMES.join(", ")}`)
  }

  const image = Buffer.from(base64, "base64")

  if (image.length === 0) {
    throw new UserError("Invalid image: decoded to an empty file")
  }
  if (image.length > MAX_IMAGE_BYTES) {
    throw new UserError(`Invalid image: ${image.length} bytes exceeds the ${MAX_IMAGE_BYTES} bytes limit`)
  }
  if (!matchesMagicNumbers(image, mime)) {
    throw new UserError(`Invalid image: content does not look like ${mime}`)
  }

  return image
}

/** Declared mime types are attacker-controlled, so check the bytes agree with them. */
function matchesMagicNumbers(image: Buffer, mime: string): boolean {
  switch (mime) {
    case "image/png":
      return image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    case "image/jpeg":
      return image[0] === 0xff && image[1] === 0xd8 && image[image.length - 2] === 0xff && image[image.length - 1] === 0xd9
    case "image/webp":
      return image.subarray(0, 4).toString("ascii") === "RIFF" && image.subarray(8, 12).toString("ascii") === "WEBP"
    case "image/gif":
      return image.subarray(0, 6).toString("ascii") === "GIF87a" || image.subarray(0, 6).toString("ascii") === "GIF89a"
    default:
      return false
  }
}
