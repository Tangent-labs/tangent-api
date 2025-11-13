import { customAlphabet } from "nanoid"
import { PrismaClient } from "@prisma/client"
import { UserData, UserStatus } from "../types.js"

const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8)

export class ReferralRepository {
  prismaClient: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prismaClient = prisma
  }

  async getReferralByCode(code: string): Promise<UserData | null> {
    try {
      const user = await this.prismaClient.user.findFirst({
        where: { code },
      })
      return user
    } catch (err) {
      throw new Error(`Failed to fetch user with code ${code}`)
    }
  }

  async getUserStatus(address: string): Promise<UserStatus> {
    try {
      const user = await this.prismaClient.user.findUnique({
        where: { address: address.toLowerCase() },
        select: {
          id: true,
          code: true,
          onboarded: true,
          godsons: true,
        },
      })

      if (!user) {
        throw new Error("User not found")
      }

      const status = {
        hasGeneratedCode: !!user.code,
        hasUsedCode: user.onboarded,
        referralCode: user.code,
        friends: user.godsons.length,
      }

      return status
    } catch (err) {
      throw new Error(`Failed to fetch user status for ${address}`)
    }
  }

  async isUserOnboarded(address: string): Promise<boolean> {
    try {
      const user = await this.prismaClient.user.findFirst({
        where: { address: address.toLowerCase() },
      })

      if (user) return user?.onboarded

      return false
    } catch (err) {
      throw new Error(`Failed to check usage for address ${address}`)
    }
  }

  /**
   *
   * @param referralCode referralCode to use for child referral
   * @param address address of the child
   * Apply the referral as cell as the boost for the child
   */
  async processReferral(referralCode: string, address: string, now: string): Promise<void> {
    const addr = address.toLowerCase()

    await this.prismaClient.$transaction(async (tx: any) => {
      const referrer = await tx.user.findFirst({
        where: { code: referralCode },
        select: { id: true, address: true },
      })
      if (!referrer) throw new Error("Invalid referral code")

      if (referrer.address.toLowerCase() === addr) {
        throw new Error("User is using their own referral code")
      }

      // Check if the user has already used a code
      const child = await tx.user.findUnique({
        where: { address: addr },
        select: { id: true, godfather: true },
      })
      if (child?.godfather) {
        throw new Error("User has already used a referral code")
      }

      // 3) Upsert user + link godfather (this is your existing logic)
      await tx.user.upsert({
        where: { address: addr },
        update: {
          onboarded: true,
          godfather: {
            create: {
              godfather_id: referrer.id,
              used_at: now,
            },
          },
        },
        create: {
          address: addr,
          onboarded: true,
          godfather: {
            create: {
              godfather_id: referrer.id,
              used_at: now,
            },
          },
        },
      })

      await tx.offchain_boost_user.create({
        data: {
          type: "ONBOARDED",
          user_address: addr,
        },
      })
    })
  }

  async generateReferralCode(address: string): Promise<string> {
    try {
      const user = await this.prismaClient.user.findUnique({
        where: { address: address.toLowerCase() },
      })
      if (user?.code) {
        throw new Error("User already has a referral code")
      }

      let code: string
      let isUnique = false

      do {
        code = nanoid()
        const existing = await this.prismaClient.user.findFirst({
          where: { code },
        })
        isUnique = !existing
      } while (!isUnique)

      await this.prismaClient.user.upsert({
        where: { address: address.toLowerCase() },
        update: { code },
        create: {
          address: address.toLowerCase(),
          code,
        },
      })

      return code
    } catch (err) {
      throw new Error(`Failed to generate referral code for address ${address}`)
    }
  }
}
