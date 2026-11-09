import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createDefaultValues } from "../../../../domain";
import type { DraftRecord } from "../../../../storage/records";
import { notifyArchiveChange } from "../../archiveChanges";
import { getHomeBalanceEntry } from "../shared/settlementUtils";
import { scanHomeBalances } from "./scanHomeBalances";
import { useArchiveBalances } from "./useArchiveBalances";

jest.mock("./scanHomeBalances", () => ({ scanHomeBalances: jest.fn() }));

function record(id: string): DraftRecord {
  return {
    id, status: "completed", step: 6, createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z",
    settlementState: { settledParticipantIds: [] },
    values: { ...createDefaultValues(), currency: "EUR", participants: [{ id: "owner", name: "You" }, { id: "friend", name: "Ana" }], payerParticipantId: "owner",
      items: [{ id: "item", name: "Dinner", price: "10.00", splitMode: "even", allocations: ["owner", "friend"].map((participantId) => ({ participantId, evenIncluded: true, shares: "1", percent: "50" })) }] },
  };
}

const entry = (value: DraftRecord) => getHomeBalanceEntry(value, "You", "EUR");
const noRecords: DraftRecord[] = [];

describe("useArchiveBalances", () => {
  beforeEach(() => jest.resetAllMocks());

  it("merges payments and deletions that complete during a scan", async () => {
    const first = record("first");
    const second = record("second");
    let finish!: (value: ReturnType<typeof entry>[]) => void;
    (scanHomeBalances as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useArchiveBalances(noRecords, "You", "EUR", true));
    const paid = { ...first, settlementState: { settledParticipantIds: ["friend"] } };
    act(() => { notifyArchiveChange({ type: "upsert", record: paid }); notifyArchiveChange({ type: "delete", id: second.id }); });
    await act(async () => finish([entry(first), entry(second)]));
    expect(result.current.balances).toEqual({ currency: "EUR", owedCents: 0, oweCents: 0 });
    expect(result.current.entries?.map((item) => item.id)).toEqual(["first"]);
  });

  it("updates one result after a write and applies pending deletion and Undo", async () => {
    const first = record("first");
    const second = record("second");
    (scanHomeBalances as jest.Mock).mockResolvedValueOnce([entry(first), entry(second)]);
    const { result, rerender } = renderHook(({ excluded }) => useArchiveBalances(noRecords, "You", "EUR", true, excluded), { initialProps: { excluded: undefined as string | undefined } });
    await waitFor(() => expect(result.current.balances?.owedCents).toBe(1000));
    const paid = { ...first, settlementState: { settledParticipantIds: ["friend"] } };
    act(() => notifyArchiveChange({ type: "upsert", record: paid }));
    expect(result.current.balances?.owedCents).toBe(500);
    rerender({ excluded: "second" });
    expect(result.current.balances?.owedCents).toBe(0);
    rerender({ excluded: undefined });
    expect(result.current.balances?.owedCents).toBe(500);
    expect(scanHomeBalances).toHaveBeenCalledTimes(1);
  });

  it("prefers optimistic loaded edits and restores the stored result after rollback", async () => {
    const original = record("first");
    (scanHomeBalances as jest.Mock).mockResolvedValueOnce([entry(original)]);
    const { result, rerender } = renderHook(({ loaded }) => useArchiveBalances(loaded, "You", "EUR", true), { initialProps: { loaded: noRecords } });
    await waitFor(() => expect(result.current.balances?.owedCents).toBe(500));
    rerender({ loaded: [{ ...original, settlementState: { settledParticipantIds: ["friend"] } }] });
    expect(result.current.balances?.owedCents).toBe(0);
    rerender({ loaded: [original] });
    expect(result.current.balances?.owedCents).toBe(500);
  });

  it("ignores an invalidated scan and permits retry after a failed scan", async () => {
    let finishOld!: (value: ReturnType<typeof entry>[]) => void;
    (scanHomeBalances as jest.Mock)
      .mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }))
      .mockRejectedValueOnce(new Error("read failed"))
      .mockResolvedValueOnce([entry(record("new"))]);
    const { result } = renderHook(() => useArchiveBalances(noRecords, "You", "EUR", true));
    act(() => notifyArchiveChange({ type: "invalidate" }));
    await waitFor(() => expect(result.current.error).toBe(true));
    await act(async () => finishOld([entry(record("old"))]));
    expect(result.current.entries).toBeNull();
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.entries?.map((item) => item.id)).toEqual(["new"]));
  });
});
