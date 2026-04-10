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
      const accountedBalances = await this.predepositRepository.getAccountedBalances(userAddress?.toString()?.toLowerCase())

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
    const message = `==============================
ELIGIBILITY CONDITIONS
TAN PRE-DEPOSIT CAMPAIGN
==============================

By participating in this Pre-Deposit campaign, you fully and unconditionally accept the terms and conditions below. Signing this Ethereum message constitutes your express acceptance of all these rules.


------------------------------
1. MANDATORY ELIGIBILITY REQUIREMENTS
------------------------------

To be eligible for an allocation of TAN governance tokens, a participant must cumulatively meet ALL of the following conditions:

(a) Have signed this official Ethereum message BEFORE making any deposit. The signature is unique and tied to your wallet address. Any signature made after the deposit or on a different message will be ignored.

(b) Provide liquidity single-sided: deposit USDC only into the USG-USDC pool, and/or deposit frxUSD only into the USG-frxUSD pool.

(c) Maintain your full LP position for the entire duration of the campaign. Any reduction in your LP balance (partial or full withdrawal) will result in a proportional reduction of your promised TAN allocation.

(d) Staking is allowed without losing allocation. You may stake your LP tokens on StakeDAO or Convex (or any other compatible protocol that does not remove the LPs from the underlying pools). Staking does not cancel or reduce your eligibility as long as the LPs remain in the USG-USDC or USG-frxUSD pools.


------------------------------
2. DISTRIBUTION MECHANICS
------------------------------

At the end of the Pre-Deposit campaign, x% of the total TAN supply will be distributed proportionally among all eligible participants, based on the amount of LP tokens effectively maintained until the final snapshot.


------------------------------
3. LEGAL DISCLAIMERS & LIMITATION OF LIABILITY
------------------------------

*** IMPORTANT — READ CAREFULLY ***

The sole purpose of this campaign is to incentivize liquidity provision to grow the USG pools. It does NOT constitute an offer of securities, an investment promise, or a binding investment contract.

The distribution of TAN is entirely conditional and will be executed exclusively via smart contract. No individual allocation is guaranteed.

The project team reserves the absolute right to:
- Modify, suspend, or cancel the campaign at any time;
- Exclude any participant suspected of Sybil attacks, wash trading, manipulation, or any other abusive behavior.

NO WARRANTIES are provided regarding:
- The future value of the TAN token;
- Its liquidity or utility;
- The ability to sell or stake the received tokens.

You participate AT YOUR OWN RISK. DeFi investments carry the risk of total loss. Neither the team, contributors, nor partners shall be held liable for any losses incurred.


------------------------------
ACKNOWLEDGEMENT
------------------------------

By signing this Ethereum message and depositing liquidity, you acknowledge that you have read, understood, and accepted all of the above conditions. Any future dispute will be considered invalid.

These terms are publicly displayed and immutable once the campaign is launched.`

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
