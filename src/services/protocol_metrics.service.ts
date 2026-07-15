import { AddressLike, isAddress } from "ethers"
import { ProtocolMetricsRepository } from "../data/protocol_metrics.data.js"
import { PositionsRoute, RawEvent, TransformedEvent } from "../types.js"
import { rangeToMinDate } from "../utils.js"

export class ProtocolMetricsService {
  protocolMetricsRepo: ProtocolMetricsRepository
  private rpcUrl: string

  constructor(protocolMetricsRepo: ProtocolMetricsRepository) {
    this.protocolMetricsRepo = protocolMetricsRepo
    this.rpcUrl = process.env.RPC_URL || ""
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

  private alignDateToBucket(date: Date, bucketSizeMinutes: number): Date {
    const aligned = new Date(date)
    const bucketMs = bucketSizeMinutes * 60_000
    aligned.setTime(Math.floor(aligned.getTime() / bucketMs) * bucketMs)
    return aligned
  }

  private async getBlockchainNow(): Promise<Date> {
    if (!this.rpcUrl) {
      return new Date()
    }

    try {
      const signal = AbortSignal.timeout(5000)
      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBlockByNumber", params: ["latest", false], id: 1 }),
        signal,
      })
      const blockJson = (await response.json()) as { result?: { timestamp?: string } }
      const blockTimestampHex = blockJson.result?.timestamp

      if (!blockTimestampHex) {
        return new Date()
      }

      return new Date(parseInt(blockTimestampHex, 16) * 1000)
    } catch {
      return new Date()
    }
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

    // dateEnd is optional from the API. When absent, use the latest blockchain
    // timestamp and snap it to the nearest lower bucket boundary before deriving
    // the historical window.
    const rawEndDate = dateEnd ? new Date(dateEnd) : await this.getBlockchainNow()

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

  async getPositions(market: string, query: PositionsRoute["Querystring"]): Promise<{ data: TransformedEvent[]; total: number }> {
    const MAX_PAGE_SIZE = 100

    const parsedPageSize = Number.parseInt(query.pageSize ?? "", 10)
    const pageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? Math.min(parsedPageSize, MAX_PAGE_SIZE) : 10

    const parsedOffset = Number.parseInt(query.offset ?? "", 10)
    const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0

    const userAddress = query.userAddress ? query.userAddress.toLowerCase() : undefined

    const { rows, total } = await this.protocolMetricsRepo.getPositions(market, { pageSize, offset, userAddress })

    return { data: this.transformEvents(rows), total }
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

  async getLatestPrices(tokenAddresses: string[]) {
    if (tokenAddresses.length === 0) {
      return []
    }

    const normalizedAddresses = tokenAddresses.map((address) => address.toLowerCase())

    if (normalizedAddresses.some((address) => !isAddress(address))) {
      throw new Error("Invalid token address")
    }

    try {
      return await this.protocolMetricsRepo.getLatestPrices(normalizedAddresses)
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getPriceHistory(address: string, from: number | null, to: number) {
    if (!isAddress(address)) {
      throw new Error("Invalid token address")
    }

    const TARGET_POINTS = 200

    const datFrom = from ? new Date(from).toISOString() : null
    const dateTo = new Date(to).toISOString()

    try {
      return await this.protocolMetricsRepo.getPriceHistory([address.toLowerCase()], datFrom, dateTo, TARGET_POINTS)
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getPriceHistoryByRange(addresses: string[], range: "1d" | "1w" | "1m" | "1y" | "all") {
    if (addresses.length === 0) {
      return []
    }

    if (addresses.length > 5) {
      throw new Error("A maximum of 5 token addresses is allowed")
    }

    const normalizedAddresses = addresses.map((address) => address.toLowerCase())

    if (normalizedAddresses.some((address) => !isAddress(address))) {
      throw new Error("Invalid token address")
    }

    const TARGET_POINTS = 200
    const now = await this.getBlockchainNow()
    const dateTo = now.toISOString()
    const normalizedRange = range
    const dateFrom = normalizedRange === "all" ? null : rangeToMinDate(normalizedRange, now.toISOString())

    try {
      const rows = await this.protocolMetricsRepo.getPriceHistory(normalizedAddresses, dateFrom, dateTo, TARGET_POINTS)
      const grouped = new Map<string, { tokenAddress: string; history: { timestamp: Date; amount: string }[] }>()

      for (const row of rows) {
        if (!grouped.has(row.tokenAddress)) {
          grouped.set(row.tokenAddress, { tokenAddress: row.tokenAddress, history: [] })
        }
        grouped.get(row.tokenAddress)!.history.push({ timestamp: row.timestamp, amount: row.amount })
      }

      return normalizedAddresses.map((tokenAddress) => grouped.get(tokenAddress) ?? { tokenAddress, history: [] })
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

  async getActiveBorrowPositions() {
    try {
      return await this.protocolMetricsRepo.getActiveBorrowPositions()
    } catch (err) {
      console.log(err)
      throw err
    }
  }
}
