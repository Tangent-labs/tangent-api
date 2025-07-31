import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import {
  getReferralByCode,
  processReferral,
  generateReferralCode,
  isUserOnboarded,
  getUserStatus,
} from "../data/referral.data";
import { ReferralInput, UserStatus } from "../types";

export async function verifyAndCreateReferralRelationship(
  prisma: PrismaClient,
  input: ReferralInput,
  logger: any
): Promise<{ message: string }> {
  const { referralCode, signature, account } = input;

  const referrer = await getReferralByCode(prisma, referralCode);
  if (!referrer) {
    throw new Error("Invalid referral code");
  }

  if (await isUserOnboarded(prisma, account.toLowerCase())) {
    throw new Error("User has already used a referral code");
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

const checkAccount = (account: string) => {
  if (!ethers.isAddress(account)) {
    throw new Error("Invalid account address");
  }
};

export async function generateNewReferralCode(
  prisma: PrismaClient,
  account: string,
  logger: any
): Promise<{ message: string }> {
  try {
    checkAccount(account);

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
    checkAccount(account);

    const status = await getUserStatus(prisma, account);
    logger.info(`Fetched referral status for account ${account}:`, status);
    return status;
  } catch (err) {
    logger.error("Error fetching referral status:", err);
    throw err;
  }
}
