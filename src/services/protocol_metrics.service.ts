import { AddressLike, isAddress } from "ethers"
import { ProtocolMetricsRepository } from "../data/protocol_metrics.data.js"
import { RawEvent, TransformedEvent } from "../types.js"

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

  /**
   * Aligns the upper time bound to the previous bucket boundary so the chart
   * uses stable time slices like 00/15/30/45 instead of sliding windows.
   */
  private alignDateToBucket(date: Date, bucketSizeMinutes: number): Date {
    const aligned = new Date(date)
    const bucketMs = bucketSizeMinutes * 60_000
    aligned.setTime(Math.floor(aligned.getTime() / bucketMs) * bucketMs)
    return aligned
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

  async getOraclePriceBuckets(market: AddressLike, dateEnd: string | undefined, bucketCount: number, bucketSizeMinutes: number) {
    if (!isAddress(String(market))) {
      throw new Error("Invalid market address")
    }

    if (!Number.isFinite(bucketCount) || bucketCount <= 0) {
      throw new Error("Invalid oracle graph bucket count")
    }

    if (!Number.isFinite(bucketSizeMinutes) || bucketSizeMinutes <= 0) {
      throw new Error("Invalid oracle graph bucket size")
    }

    // dateEnd is optional from the API. When absent, use "now" and snap it to the
    // nearest lower bucket boundary before deriving the historical window.
    const rawEndDate = dateEnd ? new Date(dateEnd) : new Date()

    if (Number.isNaN(rawEndDate.getTime())) {
      throw new Error("Invalid oracle graph end date")
    }

    // The repository query expects an explicit [start, end] window. The API exposes
    // higher-level graph controls instead: number of buckets + bucket size in minutes.
    const endDate = this.alignDateToBucket(rawEndDate, bucketSizeMinutes)
    const startDate = new Date(endDate.getTime() - bucketCount * bucketSizeMinutes * 60_000)

    if (startDate.getTime() >= endDate.getTime()) {
      return []
    }

    return await this.protocolMetricsRepo.getOraclePriceBuckets(market, startDate.toISOString(), endDate.toISOString(), bucketCount)
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

  async getTotalValueLocked(from: number | null, to: number) {
    const TARGET_POINTS = 200

    const datFrom = from ? new Date(from).toISOString() : null
    const dateTo = new Date(to).toISOString()

    try {
      return await this.protocolMetricsRepo.getTotalValueLocked(datFrom, dateTo, TARGET_POINTS)
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
