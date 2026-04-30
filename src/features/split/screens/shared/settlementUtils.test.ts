import { createDefaultValues } from "../../../../domain";
import type { DraftRecord } from "../../../../storage/records";

import { getRecordMoneyPreview } from "./settlementUtils";

function buildRecord(overrides?: Partial<DraftRecord>): DraftRecord {
  return {
    id: "draft-1",
    status: "draft",
    step: 1,
    values: createDefaultValues(),
    settlementState: { settledParticipantIds: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("settlementUtils", () => {
  it("uses default settlement resolver when a custom resolver is not provided", () => {
    const preview = getRecordMoneyPreview(buildRecord(), "Ana");
    expect(preview).toBeNull();
  });

  it("converts preview net amount into app currency when exchangeRate is present", () => {
    const preview = getRecordMoneyPreview(
      buildRecord({
        values: {
          ...createDefaultValues(),
          currency: "USD",
          exchangeRate: {
            sourceCurrency: "USD",
            targetCurrency: "EUR",
            rate: 0.5,
          },
          participants: [
            { id: "payer", name: "You" },
            { id: "ana", name: "Ana" },
          ],
          payerParticipantId: "payer",
          items: [
            {
              id: "i1",
              name: "Dinner",
              price: "10.00",
              splitMode: "even",
              allocations: [
                { participantId: "payer", evenIncluded: true, shares: "1", percent: "50" },
                { participantId: "ana", evenIncluded: true, shares: "1", percent: "50" },
              ],
            },
          ],
        },
        status: "completed",
      }),
      "You",
    );
    expect(preview?.ownerNetCents).toBe(500);
  });
});
