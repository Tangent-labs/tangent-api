import { ProtocolMetricsRepository } from "../data/protocol_metrics.data"

export class ProtocolMetricsService {
  protocolMetricsRepo: ProtocolMetricsRepository

  constructor(protocolMetricsRepo: ProtocolMetricsRepository) {
    this.protocolMetricsRepo = protocolMetricsRepo
  }

  async getTotalSupply(address: string, from: string, to: string) {
    try {
      const result = await this.protocolMetricsRepo.getTotalSupply(address, from, to)

      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }
}
