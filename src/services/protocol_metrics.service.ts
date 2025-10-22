import { ProtocolMetricsRepository } from "../data/protocol_metrics.data"

export class ProtocolMetricsService {
  protocolMetricsRepo: ProtocolMetricsRepository

  constructor(protocolMetricsRepo: ProtocolMetricsRepository) {
    this.protocolMetricsRepo = protocolMetricsRepo
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
