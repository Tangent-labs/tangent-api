import { ethers } from "ethers"
import { ReferralInput, UserStatus } from "../types.js"
import { ReferralRepository } from "../data/referral.data.js"
import { UserError } from "../utils.js"
import { FastifyBaseLogger } from "fastify"

// EIP-1271: value returned by isValidSignature(bytes32,bytes) on success
const EIP1271_MAGIC_VALUE = "0x1626ba7e"
const ERC1271_ABI = ["function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)"]
const RPC_URL = process.env.RPC_URL || "https://ethereum-rpc.publicnode.com/"

export class ReferralService {
  referralRepo: ReferralRepository
  private provider: ethers.JsonRpcProvider

  constructor(referralRepo: ReferralRepository) {
    this.referralRepo = referralRepo
    this.provider = new ethers.JsonRpcProvider(RPC_URL)
  }

  // Verifies a personal_sign message against `account`, supporting both EOA
  // wallets (ECDSA recovery) and smart-contract wallets like Gnosis Safe (EIP-1271).
  private async isValidSignature(message: string, signature: string, account: string, logger: FastifyBaseLogger): Promise<boolean> {
    // EOA path: recover the signer and compare.
    try {
      const recovered = ethers.verifyMessage(message, signature)
      if (recovered.toLowerCase() === account.toLowerCase()) {
        return true
      }
    } catch {
      // Not a recoverable EOA signature (e.g. a Safe's 130-byte payload) — fall through.
    }

    // Smart-contract wallet path: ask the contract to validate the signature on-chain.
    try {
      const contract = new ethers.Contract(account, ERC1271_ABI, this.provider)
      const hash = ethers.hashMessage(message)
      const result = await contract.isValidSignature(hash, signature)
      return result === EIP1271_MAGIC_VALUE
    } catch (err) {
      logger.error({ msg: "EIP-1271 signature verification failed:", err })
      return false
    }
  }

  async verifyAndCreateReferralRelationship(input: ReferralInput, logger: FastifyBaseLogger): Promise<{ message: string }> {
    const { referralCode, signature, account, now } = input

    const referrer = await this.referralRepo.getReferralByCode(referralCode)
    if (!referrer) {
      throw new UserError("Invalid referral code")
    }

    if (await this.referralRepo.isUserOnboarded(account.toLowerCase())) {
      throw new UserError("User has already used a referral code")
    }

    const message = `By signing this message, I'm enrolling in the Tangent referral program using code: ${referralCode}

This signature is free and does not authorize any transaction.`
    const valid = await this.isValidSignature(message, signature, account, logger)
    if (!valid) {
      throw new UserError("Invalid signature")
    }

    await this.referralRepo.processReferral(referralCode, account, now)
    logger.info(`Referral processed for account ${account} with code ${referralCode}`)

    return { message: "Referral successfully processed" }
  }

  checkAccount = (account: string) => {
    if (!ethers.isAddress(account)) {
      throw new UserError("Invalid account address")
    }
  }

  async generateNewReferralCode(account: string, logger: FastifyBaseLogger): Promise<{ message: string }> {
    try {
      this.checkAccount(account)

      const code = await this.referralRepo.generateReferralCode(account.toLowerCase())
      logger.info(`Generated referral code ${code} for account ${account}`)
      return { message: code }
    } catch (err) {
      logger.error({ msg: "Error generating referral code:", err })
      throw err
    }
  }

  async getReferralStatus(account: string, logger: FastifyBaseLogger): Promise<UserStatus> {
    try {
      this.checkAccount(account)

      const status = await this.referralRepo.getUserStatus(account.toLowerCase())
      logger.info({ msg: `Fetched referral status for account ${account}:`, status })
      return status
    } catch (err) {
      logger.error({ msg: "Error fetching referral status:", err })
      throw err
    }
  }
}
