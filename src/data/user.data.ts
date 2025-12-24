import { PrismaClient } from "@prisma/client"

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async upsertByAddress(address: string) {
    await this.prisma.boost_subscribers.upsert({
      where: { user_address: address },
      update: {},
      create: { user_address: address },
    })

    return this.prisma.user.upsert({
      where: { address },
      update: {},
      create: { address },
    })
  }
}
