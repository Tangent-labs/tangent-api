import { RawEvent, TransformedEvent } from "../types";

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
