import { RawEvent } from "../data/events.data";

// Interface for the transformed event for the frontend
export interface TransformedEvent {
  label: string;
  amount: string;
  usgAmount: string;
  date: string;
  market: string;
  txHash: string;
}

// Transform raw events for the frontend
export function transformEvents(rawEvents: RawEvent[]): TransformedEvent[] {
  return rawEvents.map((event) => ({
    label: event.label,
    amount: event.amount,
    usgAmount: event.usg_amount,
    date: new Date(event.date).toISOString(),
    market: event.market,
    txHash: event.tx_hash,
  }));
}
