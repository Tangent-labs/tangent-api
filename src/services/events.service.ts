import { PrismaClient } from "@prisma/client";
import { RawEvent, TotalBorrowPoint, TransformedEvent } from "../types";
import { getTotalBorrow } from "../data/events.data";

export function transformEvents(rawEvents: RawEvent[]): TransformedEvent[] {
  return rawEvents.map((event) => ({
    label: event.label,
    collatAmount: event.collat_amount,
    usgAmount: event.usg_amount,
    date: new Date(event.date).toISOString(),
    txHash: event.tx_hash,
  }));
}

export async function getTotalBorrowOverTime(
  prisma: PrismaClient,
  logger: any,
  range: string
): Promise<{ latestTotalDebt: string; data: TotalBorrowPoint[] }> {
  try {
    const result = await getTotalBorrow(prisma, range);
    logger.info(`Fetched total borrow data for range ${range}`);
    return result;
  } catch (err) {
    logger.error("Error in borrow service:", err);
    throw err;
  }
}
