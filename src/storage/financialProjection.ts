import { computeSettlement } from "../domain";
import type { DraftRecord } from "./records";

/** Owner-independent financial data. The owner and display currency can change later. */
export type FinancialProjection = {
  version: 1;
  currency: string;
  splitDate?: string;
  exchangeRate: DraftRecord["values"]["exchangeRate"];
  settledParticipantIds: string[];
  settlement: null | {
    currency: string;
    people: Array<{ participantId: string; name: string; netCents: number; isPayer: boolean }>;
  };
};

export function createFinancialProjection(record: DraftRecord): FinancialProjection {
  const result = computeSettlement(record.values);
  return {
    version: 1,
    currency: record.values.currency,
    splitDate: record.values.splitDate,
    exchangeRate: record.values.exchangeRate,
    settledParticipantIds: record.settlementState.settledParticipantIds,
    settlement: result.ok ? {
      currency: result.data.currency,
      people: result.data.people.map(({ participantId, name, netCents, isPayer }) => ({ participantId, name, netCents, isPayer })),
    } : null,
  };
}
