import { AddressLike, verifyMessage, ZeroAddress } from "ethers"
import { PredepositRepository } from "../data/predeposit.data.js"
import { PredepositInput } from "../routes/predeposit.route.js"

const lpNames = ["USG-USDC", "USG-frxUSD"]
function otherStablesInfo(lpName: string) {
  if (lpName === "USG-USDC") {
    return {
      name: "USDC",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      decimals: 6,
    }
  } else {
    return {
      name: "frxUSD",
      address: "0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29",
      decimals: 18,
    }
  }
}
export class PredepositService {
  predepositRepository: PredepositRepository

  constructor(predepositRepository: PredepositRepository) {
    this.predepositRepository = predepositRepository
  }

  async fetchFrontData(userAddress: AddressLike) {
    const predepositState = (await this.predepositRepository.getPredepositState())?.state
    if (!predepositState) {
      throw Error("Predeposit not started")
    }
    let userState: string
    let isSigned: boolean
    const userStatusRow = await this.predepositRepository.getUserStatus(userAddress.toString())
    if (!userStatusRow) {
      userState = "public"
      isSigned = false
    } else {
      userState = userStatusRow.is_private ? "private" : "public"
      isSigned = userStatusRow.signature ? true : false
    }
    const lpData: {
      accumulatedBalance: string
      accumulatedTotal: string
      cap: string
      lpName: string
      otherStable: { name: string; address: string; decimals: number }
    }[] = []
    const accountedTotals = await this.predepositRepository.getAccountedTotals()

    if (userAddress.toString() === ZeroAddress.toString()) {
      lpNames.forEach((lp) => {
        const total = accountedTotals.find((acc) => acc.usg_lp.lp_name === lp)!
        lpData.push({ accumulatedBalance: "0", accumulatedTotal: total.total_lp, cap: total.cap_lp, lpName: lp, otherStable: otherStablesInfo(lp) })
      })
    } else {
      const accountedBalances = await this.predepositRepository.getAccountedBalances(userAddress)
      lpNames.forEach((lp) => {
        const total = accountedTotals.find((acc) => acc.usg_lp.lp_name === lp)!
        const balance = accountedBalances.find((accBal) => accBal.usg_lp.lp_name === lp)?.balance_lp
        lpData.push({
          accumulatedBalance: balance ? balance : "0",
          accumulatedTotal: total.total_lp,
          cap: total.cap_lp,
          lpName: lp,
          otherStable: otherStablesInfo(lp),
        })
      })
    }

    return { predepositState, userState, isSigned, lpData: lpData }
  }

  async verifyAndStoreSignature(input: PredepositInput) {
    const { signature, account } = input
    const accountLower = account.toLowerCase()

    const predepositState = (await this.predepositRepository.getPredepositState())?.state

    if (!predepositState) {
      throw Error("Predeposit not started")
    }

    // Retrieve the row corresponding to the user passed in input
    const userStatusRow = await this.predepositRepository.getUserStatus(accountLower)

    // On the private deposit phase, we verify that the userStatus row has the is_private flag to true
    // Otherwise he is not WL and we throw an error
    if (predepositState === "deposit_private" && !(userStatusRow && userStatusRow.is_private)) {
      throw new Error(`User ${accountLower} is not white listed in the predeposit campaign`)
    } else if (predepositState === "finished" || predepositState === "retention") {
      throw new Error("Deposit is finished")
    }
    const message = `I, owner of wallet ${accountLower} assess to participate to the predeposit campaign.`
    let recoveredAddress: string
    try {
      recoveredAddress = verifyMessage(message, signature)
    } catch (err) {
      throw new Error("Invalid signature", { cause: err })
    }
    if (recoveredAddress.toLowerCase() !== accountLower) {
      throw new Error("Account provided and signature do not match")
    }

    const entry = { user_address: accountLower, signature: input.signature, is_private: false }
    // An entry already exists
    if (userStatusRow) {
      if (userStatusRow.signature) {
        throw new Error("Already signed")
      }
      entry.is_private = userStatusRow.is_private
    }
    await this.predepositRepository.storeSignature(entry)

    return { message: "Subscribed to Predeposit program successfully" }
  }
}
