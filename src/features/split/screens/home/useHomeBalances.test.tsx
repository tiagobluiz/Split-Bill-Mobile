import { act, renderHook } from "@testing-library/react-native";

import { createDefaultValues } from "../../../../domain";
import type { DraftRecord } from "../../../../storage/records";
import { useHomeBalances } from "./useHomeBalances";

function record(id: string): DraftRecord {
  return {
    id, status: "completed", step: 6,
    createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z",
    settlementState: { settledParticipantIds: [] },
    values: {
      ...createDefaultValues(), currency: "EUR",
      participants: [{ id: "owner", name: "You" }, { id: "friend", name: "Ana" }],
      payerParticipantId: "owner",
      items: [{
        id: "item", name: "Dinner", price: "10.00", splitMode: "even",
        allocations: ["owner", "friend"].map((participantId) => ({ participantId, evenIncluded: true, shares: "1", percent: "50" })),
      }],
    },
  };
}

describe("useHomeBalances", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("shows a loading state until every batch contributes to the total", () => {
    const records = Array.from({ length: 30 }, (_, index) => record(String(index)));
    const { result } = renderHook(() => useHomeBalances(records, "You", "EUR", true));
    expect(result.current).toBeNull();
    act(() => { jest.runOnlyPendingTimers(); });
    expect(result.current).toBeNull();
    act(() => { jest.runAllTimers(); });
    expect(result.current).toEqual({ currency: "EUR", owedCents: 15000, oweCents: 0 });
  });

  it("discards an unfinished calculation when the records change", () => {
    const original = Array.from({ length: 30 }, (_, index) => record(String(index)));
    const next = [record("new")];
    const { result, rerender } = renderHook(({ records }) => useHomeBalances(records, "You", "EUR", true), { initialProps: { records: original } });
    act(() => { jest.runOnlyPendingTimers(); });
    rerender({ records: next });
    act(() => { jest.runAllTimers(); });
    expect(result.current).toEqual({ currency: "EUR", owedCents: 500, oweCents: 0 });
  });
});
