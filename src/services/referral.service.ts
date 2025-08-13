import { ethers } from "ethers"
import { ReferralInput, UserStatus } from "../types"
import { ReferalRepository } from "../data/referral.data"

export class ReferalService {
  referalRepo: ReferalRepository
  constructor(referalRepo: ReferalRepository) {
    this.referalRepo = referalRepo
  }
  async verifyAndCreateReferralRelationship(input: ReferralInput, logger: any): Promise<{ message: string }> {
    const { referralCode, signature, account } = input

    const referrer = await this.referalRepo.getReferralByCode(referralCode)
    if (!referrer) {
      throw new Error("Invalid referral code")
    }

    if (await this.referalRepo.isUserOnboarded(account.toLowerCase())) {
      throw new Error("User has already used a referral code")
    }

    const message = `I am using the following referral code ${referralCode}`
    let recoveredAddress: string
    try {
      recoveredAddress = ethers.verifyMessage(message, signature)
    } catch (err) {
      logger.error("Signature verification failed:", err)
      throw new Error("Invalid signature")
    }

    if (recoveredAddress.toLowerCase() !== account.toLowerCase()) {
      throw new Error("Signature does not match account")
    }

    await this.referalRepo.processReferral(referralCode, account)
    logger.info(`Referral processed for account ${account} with code ${referralCode}`)

    return { message: "Referral successfully processed" }
  }

  checkAccount = (account: string) => {
    if (!ethers.isAddress(account)) {
      throw new Error("Invalid account address")
    }
  }

  async generateNewReferralCode(account: string, logger: any): Promise<{ message: string }> {
    try {
      this.checkAccount(account)

      const code = await this.referalRepo.generateReferralCode(account.toLowerCase())
      logger.info(`Generated referral code ${code} for account ${account}`)
      return { message: code }
    } catch (err) {
      logger.error("Error generating referral code:", err)
      throw err
    }
  }

  async getReferralStatus(account: string, logger: any): Promise<UserStatus> {
    try {
      this.checkAccount(account)

      const status = await this.referalRepo.getUserStatus(account.toLowerCase())
      logger.info(`Fetched referral status for account ${account}:`, status)
      return status
    } catch (err) {
      logger.error("Error fetching referral status:", err)
      throw err
    }
  }
}
