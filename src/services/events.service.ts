import { RawEvent } from "../data/events.data";

// Interface for the transformed event for the frontend
export interface TransformedEvent {
  label: string;
  collatAmount: string;
  usgAmount: string;
  date: string;
  txHash: string;
}

// Transform raw events for the frontend
export function transformEvents(rawEvents: RawEvent[]): TransformedEvent[] {
  return rawEvents.map((event) => ({
    label: event.label,
    collatAmount: event.collat_amount,
    usgAmount: event.usg_amount,
    date: new Date(event.date).toISOString(),
    txHash: event.tx_hash,
  }));
}
