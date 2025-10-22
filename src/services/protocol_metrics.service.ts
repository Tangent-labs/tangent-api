import { ProtocolMetricsRepository } from "../data/protocol_metrics.data"

export class ProtocolMetricsService {
  protocolMetricsRepo: ProtocolMetricsRepository

  constructor(protocolMetricsRepo: ProtocolMetricsRepository) {
    this.protocolMetricsRepo = protocolMetricsRepo
  }

  async getTotalSupply(address: string, from: string | null, to: string) {
    const TARGET_POINTS = 200
    try {
      return await this.protocolMetricsRepo.getTotalSupply(address, from, to, TARGET_POINTS)
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
}
