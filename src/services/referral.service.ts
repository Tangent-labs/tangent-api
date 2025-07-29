import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import {
  getReferralByCode,
  getUserByAddress,
  processReferral,
  generateReferralCode,
  hasUserUsedCode,
  getUserStatus,
} from "../data/referral.data";
import { ReferralInput, UserStatus } from "../types";

export async function verifyAndProcessReferral(
  prisma: PrismaClient,
  input: ReferralInput,
  logger: any
): Promise<{ message: string }> {
  const { referralCode, signature, account } = input;

  const referral = await getReferralByCode(prisma, referralCode);
  if (!referral) {
    throw new Error("Invalid referral code");
  }

  if (referral.expires_at && new Date() > referral.expires_at) {
    throw new Error("Referral code has expired");
  }

  const user = await getUserByAddress(prisma, account);
  if (user?.onboarded) {
    throw new Error("User already onboarded");
  }

  if (await hasUserUsedCode(prisma, referralCode, account.toLowerCase())) {
    throw new Error("User has already used this referral code");
  }

  const message = `I am using the following referral code ${referralCode}`;
  let recoveredAddress: string;
  try {
    recoveredAddress = ethers.verifyMessage(message, signature);
  } catch (err) {
    logger.error("Signature verification failed:", err);
    throw new Error("Invalid signature");
  }

  if (recoveredAddress.toLowerCase() !== account.toLowerCase()) {
    throw new Error("Signature does not match account");
  }

  await processReferral(prisma, referralCode, account);
  logger.info(
    `Referral processed for account ${account} with code ${referralCode}`
  );

  return { message: "Referral successfully processed" };
}

export async function generateNewReferralCode(
  prisma: PrismaClient,
  account: string,
  logger: any
): Promise<{ message: string }> {
  try {
    if (!/^0x[a-fA-F0-9]{40}$/.test(account)) {
      throw new Error("Invalid account address");
    }

    const code = await generateReferralCode(prisma, account.toLowerCase());
    logger.info(`Generated referral code ${code} for account ${account}`);
    return { message: code };
  } catch (err) {
    logger.error("Error generating referral code:", err);
    throw err;
  }
}

export async function getReferralStatus(
  prisma: PrismaClient,
  account: string,
  logger: any
): Promise<UserStatus> {
  try {
    if (!/^0x[a-fA-F0-9]{40}$/.test(account)) {
      throw new Error("Invalid account address");
    }

    const status = await getUserStatus(prisma, account);
    logger.info(`Fetched referral status for account ${account}:`, status);
    return status;
  } catch (err) {
    logger.error("Error fetching referral status:", err);
    throw err;
  }
}
