import { PrismaClient } from "@prisma/client"
import { AddressLike } from "ethers"

export class PredepositRepository {
  prismaClient: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prismaClient = prisma
  }

  async getAccountedTotals() {
    return await this.prismaClient.accounted_total.findMany({
      select: {
        usg_lp: {
          select: {
            lp_name: true,
          },
        },
        cap_lp: true,
        total_lp: true,
      },
    })
  }

  async getAccountedBalances(userAddress: AddressLike) {
    return await this.prismaClient.accounted_balances.findMany({
      select: {
        balance_lp: true,
        usg_lp: {
          select: {
            lp_name: true,
          },
        },
      },
      where: {
        user_address: {
          equals: userAddress.toString(),
        },
      },
    })
  }

  async getPredepositState() {
    return await this.prismaClient.predeposit_state.findFirst()
  }

  async getUserStatus(userAddress: string) {
    return await this.prismaClient.predeposit_users.findFirst({
      where: {
        user_address: {
          equals: userAddress,
        },
      },
    })
  }

  async storeSignature(entry: { user_address: string; signature: string; is_private: boolean }) {
    await this.prismaClient.$transaction(async (tx) => {
      // Delete the old line
      await tx.predeposit_users.deleteMany({
        where: {
          user_address: entry.user_address,
        },
      })
      // Insert the new line
      await tx.predeposit_users.create({
        data: entry,
      })
    })
  }
}
