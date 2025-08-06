import { PrismaClient } from "@prisma/client"
import { customAlphabet } from "nanoid"
import { UserData, UserStatus } from "../types"

const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8)

export class ReferalRepository {
  prisma: PrismaClient
  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient
  }

  async getReferralByCode(code: string): Promise<UserData | null> {
    try {
      const user = await this.prisma.user.findFirst({
        where: { code },
      })
      return user
    } catch (err) {
      throw new Error(`Failed to fetch user with code ${code}`)
    }
  }

  async getUserByAddress(prisma: PrismaClient, address: string): Promise<UserData | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { address: address.toLowerCase() },
      })
      return user
    } catch (err) {
      throw new Error(`Failed to fetch user ${address}`)
    }
  }

  async getUserStatus(address: string): Promise<UserStatus> {
    try {
      const user = await this.prisma.user.findUnique({
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
      const user = await this.prisma.user.findFirst({
        where: { address: address.toLowerCase() },
      })

      if (user) return user?.onboarded

      return false
    } catch (err) {
      throw new Error(`Failed to check usage for address ${address}`)
    }
  }

  async processReferral(referralCode: string, address: string): Promise<void> {
    try {
      const referrer = await this.prisma.user.findFirst({
        where: { code: referralCode },
        select: { id: true, address: true },
      })
      if (!referrer) {
        throw new Error("Invalid referral code")
      }

      if (referrer?.address === address) {
        throw new Error("User is using hiw own referral code")
      }

      // Check if the user has already used a code
      const existingUsage = await this.prisma.referral_usages.findFirst({
        where: { godfather_id: referrer?.id },
      })
      if (existingUsage) {
        throw new Error("User has already used a referral code")
      }

      await this.prisma.user.upsert({
        where: { address: address.toLowerCase() },
        update: {
          onboarded: true,
          godfather: {
            create: {
              godfather_id: referrer.id,
              used_at: new Date(),
            },
          },
        },
        create: {
          address: address.toLowerCase(),
          onboarded: true,
          godfather: {
            create: {
              godfather_id: referrer.id,
              used_at: new Date(),
            },
          },
        },
      })
    } catch (err) {
      throw new Error(`Failed to process referral for code ${referralCode} and address ${address}`)
    }
  }

  async generateReferralCode(address: string): Promise<string> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { address: address.toLowerCase() },
      })
      if (user?.code) {
        throw new Error("User already has a referral code")
      }

      let code: string
      let isUnique = false

      do {
        code = nanoid()
        const existing = await this.prisma.user.findFirst({
          where: { code },
        })
        isUnique = !existing
      } while (!isUnique)

      await this.prisma.user.upsert({
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
