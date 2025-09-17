import { AddressLike } from "ethers"
import { EventRepository } from "../data/events.data"
import { RawEvent, TransformedEvent } from "../types"

export class EventsService {
  eventsRepo: EventRepository

  constructor(eventsRepo: EventRepository) {
    this.eventsRepo = eventsRepo
  }

  async getEventsByAccount(account: string, market: string): Promise<RawEvent[]> {
    return await this.eventsRepo.getEventsByAccount(account, market)
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
      const result = await this.eventsRepo.getHistoricalData(market, dateFrom, range)

      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getUserVoteTasks(userAddress: string) {
    try {
      const result = await this.eventsRepo.getUserVoteTasks(userAddress)

      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }
  async getUserTasks(userAddress: string) {
    try {
      const result = await this.eventsRepo.getUserTasks(userAddress)

      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async getLpUserPoints(userAddress: string, dateFrom: string) {
    try {
      const result = await this.eventsRepo.getLpUserPoints(userAddress, dateFrom)

      return result
    } catch (err) {
      console.log(err)
      throw err
    }
  }
}
