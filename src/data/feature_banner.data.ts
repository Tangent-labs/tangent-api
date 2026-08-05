import { PrismaClient } from "@prisma/client"

export interface FeatureBannerInput {
  slot: number
  text: string
  link: string
  image: Uint8Array<ArrayBuffer>
  image_mime: string
}

export class FeatureBannerRepository {
  constructor(private prisma: PrismaClient) {}

  /** Metadata only: the image bytes are served separately so listing stays cheap. */
  async findAllMeta() {
    return this.prisma.feature_banner.findMany({
      select: { slot: true, text: true, link: true, image_mime: true, updated_at: true },
      orderBy: { slot: "asc" },
    })
  }

  async findImage(slot: number) {
    return this.prisma.feature_banner.findUnique({
      where: { slot },
      select: { image: true, image_mime: true, updated_at: true },
    })
  }

  /**
   * The table always mirrors exactly what the dApp should display, so an upload
   * wipes it and rewrites it in one transaction rather than diffing slots.
   */
  async replaceAll(banners: FeatureBannerInput[]) {
    return this.prisma.$transaction([
      this.prisma.feature_banner.deleteMany({}),
      this.prisma.feature_banner.createMany({ data: banners }),
    ])
  }
}
