import { RawEvent } from "../data/events.data";

// Interface for the transformed event for the frontend
export interface TransformedEvent {
  label: string;
  amount: string;
  date: string;
}

// Transform raw events for the frontend
export function transformEvents(rawEvents: RawEvent[]): TransformedEvent[] {
  console.log("rawEvents : ", rawEvents);
  return rawEvents.map((event) => ({
    label: event.label,
    amount: event.amount,
    date: new Date(event.date).toISOString(),
  }));
}
