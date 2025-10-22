import { PrismaClient } from "@prisma/client"

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async upsertByAddress(address: string) {
    return this.prisma.user.upsert({
      where: { address },
      update: {},
      create: { address },
    })
  }
}
