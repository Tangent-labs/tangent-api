import { AddressLike } from "ethers"
import { ProtocolMetricsRepository } from "../data/protocol_metrics.data"
import { RawEvent, TransformedEvent } from "../types"

export class ProtocolMetricsService {
  protocolMetricsRepo: ProtocolMetricsRepository

  constructor(protocolMetricsRepo: ProtocolMetricsRepository) {
    this.protocolMetricsRepo = protocolMetricsRepo
  }


  transformEvents(rawEvents: RawEvent[]): TransformedEvent[] {
    return rawEvents.map((event) => ({
      label: event.label,
      collatAmount: event.collat_amount,
      usgAmount: event.usg_amount,
      date: new Date(event.date).toISOString(),
      txHash: event.tx_hash,
    }))
  }

  async getMarketHistoricalData(market: AddressLike, dateFrom: string, range: string) {
    try {
      const result = await this.protocolMetricsRepo.getHistoricalData(market, dateFrom, range)

      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getEventsByAccount(account: string, market: string): Promise<RawEvent[]> {
    return await this.protocolMetricsRepo.getEventsByAccount(account, market)
  }

  async getSUSGApy(from: number | null, to: number) {
    const TARGET_POINTS = 200

    const datFrom = from ? new Date(from).toISOString() : null
    const dateTo = new Date(to).toISOString()

    try {
      return await this.protocolMetricsRepo.getSUSGApy("SAVING_APY_USG", datFrom, dateTo, TARGET_POINTS)
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getTotalSupply(address: string, from: number | null, to: number) {
    const TARGET_POINTS = 200

    const datFrom = from ? new Date(from).toISOString() : null
    const dateTo = new Date(to).toISOString()

    try {
      return await this.protocolMetricsRepo.getTotalSupply(address, datFrom, dateTo, TARGET_POINTS)
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getLastMarketAprs() {
    try {
      const result = await this.protocolMetricsRepo.getLastMarketAprs()

      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getSavingAccountsApy() {
    try {
      return await this.protocolMetricsRepo.getSavingAccountsApy()
    } catch (err) {
      console.log(err)
      throw err
    }
  }
}
