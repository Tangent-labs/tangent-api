import { PrismaClient } from "@prisma/client";
import { customAlphabet } from "nanoid";
import { ReferralData, UserData, UserStatus } from "../types";

const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

export async function getReferralByCode(
  prisma: PrismaClient,
  code: string
): Promise<ReferralData | null> {
  try {
    const referral = await prisma.referral_code.findUnique({
      where: { code },
    });
    return referral;
  } catch (err) {
    throw new Error(`Failed to fetch referral code ${code}: `);
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
    throw new Error(`Failed to fetch user ${address}: `);
  }
}

export async function hasUserUsedCode(
  prisma: PrismaClient,
  code: string,
  userId: string
): Promise<boolean> {
  try {
    const a = await prisma.referral_code.findUnique({ where: { code } });

    const usage = await prisma.referral_usage.findUnique({
      where: {
        referral_code_id_user_id: {
          referral_code_id: Number(a?.id),
          user_id: userId,
        },
      },
    });
    return !!usage;
  } catch (err) {
    throw new Error(
      `Failed to check usage for code ${code} and user ${userId}: `
    );
  }
}

export async function processReferral(
  prisma: PrismaClient,
  referralCode: string,
  account: string
): Promise<void> {
  try {
    const referral = await prisma.referral_code.findUnique({
      where: { code: referralCode },
    });
    if (!referral) {
      throw new Error("Invalid referral code");
    }

    await prisma.$transaction([
      // Create ReferralUsage record
      prisma.referral_usage.create({
        data: {
          referral_code_id: referral.id,
          user_id: account.toLowerCase(),
          used_at: new Date(),
        },
      }),
      // Update or create User
      prisma.user.upsert({
        where: { address: account.toLowerCase() },
        update: { onboarded: true },
        create: {
          id: account.toLowerCase(),
          address: account.toLowerCase(),
          onboarded: true,
        },
      }),
      // Increment referralCount for the referring user
      prisma.user.update({
        where: { id: referral.user_id },
        data: { referral_count: { increment: 1 } },
      }),
    ]);
  } catch (err) {
    throw new Error(
      `Failed to process referral for code ${referralCode} and account ${account}: `
    );
  }
}

export async function generateReferralCode(
  prisma: PrismaClient,
  userId: string
): Promise<string> {
  try {
    // Check if user already has a referral code
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.code) {
      throw new Error("User already has a referral code");
    }

    let code: string;
    let isUnique = false;

    do {
      code = nanoid();
      const existing = await prisma.referral_code.findUnique({
        where: { code },
      });
      isUnique = !existing;
    } while (!isUnique);

    await prisma.$transaction([
      prisma.referral_code.create({
        data: {
          code,
          user_id: userId,
          created_at: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { code },
      }),
    ]);

    return code;
  } catch (err) {
    throw new Error(`Failed to generate referral code for user ${userId}: `);
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
        code: true,
        onboarded: true,
        referral_count: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const status = {
      hasUsedCode: user.onboarded,
      referralCode: user.code,
      friends: user.referral_count,
    };

    return status;
  } catch (err) {
    throw new Error(`Failed to fetch user status for ${address}`);
  }
}
