import { RawEvent, TransformedEvent } from "../types"
import { EventRepository } from "../data/events.data"
import { AddressLike } from "ethers"

export function transformEvents(rawEvents: RawEvent[]): TransformedEvent[] {
  return rawEvents.map((event) => ({
    label: event.label,
    collatAmount: event.collat_amount,
    usgAmount: event.usg_amount,
    date: new Date(event.date).toISOString(),
    txHash: event.tx_hash,
  }))
}

export async function getMarketHistoricalData(eventRepository: EventRepository, market: AddressLike, dateFrom: string, range: string) {
  try {
    const result = await eventRepository.getHistoricalData(market, dateFrom, range)

    return result
  } catch (err) {
    console.log(err)
    throw err
  }
}

export async function getUserTasks(eventRepository: EventRepository, userAddress: string) {
  try {
    const result = await eventRepository.getUserTasks(userAddress)

    return result
  } catch (err) {
    console.log(err)
    throw err
  }
}
