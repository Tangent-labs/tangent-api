import { PrismaClient } from "@prisma/client";
import { customAlphabet } from "nanoid";
import { UserData, UserStatus } from "../types";

const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

export async function getReferralByCode(
  prisma: PrismaClient,
  code: string
): Promise<UserData | null> {
  try {
    const user = await prisma.user.findFirst({
      where: { code },
    });
    return user;
  } catch (err) {
    throw new Error(`Failed to fetch user with code ${code}`);
  }
}

export async function getUserByAddress(
  prisma: PrismaClient,
  address: string
): Promise<UserData | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
    });
    return user;
  } catch (err) {
    throw new Error(`Failed to fetch user ${address}`);
  }
}

export async function getUserStatus(
  prisma: PrismaClient,
  address: string
): Promise<UserStatus> {
  try {
    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
      select: {
        id: true,
        code: true,
        onboarded: true,
        referred_users: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const status = {
      hasGeneratedCode: !!user.code,
      hasUsedCode: user.onboarded,
      referralCode: user.code,
      friends: user.referred_users.length,
    };

    return status;
  } catch (err) {
    throw new Error(`Failed to fetch user status for ${address}`);
  }
}

export async function isUserOnboarded(
  prisma: PrismaClient,
  address: string
): Promise<boolean> {
  try {
    const user = await prisma.user.findFirst({
      where: { address: address.toLowerCase() },
    });

    if (user) return user?.onboarded;

    return false;
  } catch (err) {
    throw new Error(`Failed to check usage for address ${address}`);
  }
}

export async function processReferral(
  prisma: PrismaClient,
  referralCode: string,
  address: string
): Promise<void> {
  try {
    const referrer = await prisma.user.findFirst({
      where: { code: referralCode },
      select: { id: true, address: true },
    });
    if (!referrer) {
      throw new Error("Invalid referral code");
    }

    if (referrer?.address === address) {
      throw new Error("User is using hiw own referral code");
    }

    // Check if the user has already used a code
    const existingUsage = await prisma.referral_usages.findFirst({
      where: { address: address.toLowerCase() },
    });
    if (existingUsage) {
      throw new Error("User has already used a referral code");
    }

    await prisma.user.upsert({
      where: { address: address.toLowerCase() },
      update: {
        onboarded: true,
        referral_usages: {
          create: {
            referrer_id: referrer.id,
            used_at: new Date(),
          },
        },
      },
      create: {
        address: address.toLowerCase(),
        onboarded: true,
        referral_usages: {
          create: {
            referrer_id: referrer.id,
            used_at: new Date(),
          },
        },
      },
    });
  } catch (err) {
    throw new Error(
      `Failed to process referral for code ${referralCode} and address ${address}`
    );
  }
}

export async function generateReferralCode(
  prisma: PrismaClient,
  address: string
): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
    });
    if (user?.code) {
      throw new Error("User already has a referral code");
    }

    let code: string;
    let isUnique = false;

    do {
      code = nanoid();
      const existing = await prisma.user.findFirst({
        where: { code },
      });
      isUnique = !existing;
    } while (!isUnique);

    await prisma.user.upsert({
      where: { address: address.toLowerCase() },
      update: { code },
      create: {
        address: address.toLowerCase(),
        code,
      },
    });

    return code;
  } catch (err) {
    throw new Error(`Failed to generate referral code for address ${address}`);
  }
}
