import { createDefaultValues } from "../../../../domain";
import { getFinancialProjectionsByIds, type DraftRecord } from "../../../../storage/records";
import { createFinancialProjection } from "../../../../storage/financialProjection";
import { listSplitIds } from "../../../../storage/splitList";
import { scanHomeBalances } from "./scanHomeBalances";

jest.mock("../../../../storage/records", () => ({ getFinancialProjectionsByIds: jest.fn() }));
jest.mock("../../../../storage/splitList", () => ({ listSplitIds: jest.fn() }));

function record(id: string): DraftRecord {
  return { id, status: "draft", step: 1, values: createDefaultValues(), settlementState: { settledParticipantIds: [] }, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
}
function projection(id: string) {
  const value = record(id);
  return { id, createdAt: value.createdAt, projection: createFinancialProjection(value) };
}

describe("scanHomeBalances", () => {
  beforeEach(() => jest.resetAllMocks());

  it("reads bounded pages and retains compact results in list order", async () => {
    const cursor = { id: "a", splitDate: "2026-01-01", createdAt: "2026-01-01" };
    (listSplitIds as jest.Mock)
      .mockResolvedValueOnce({ records: [{ id: "a" }, { id: "deleted" }], nextCursor: cursor })
      .mockResolvedValueOnce({ records: [{ id: "b" }], nextCursor: null });
    (getFinancialProjectionsByIds as jest.Mock).mockResolvedValueOnce([projection("a")]).mockResolvedValueOnce([projection("b")]);
    const result = await scanHomeBalances({ ownerName: "You", currency: "EUR", isCancelled: () => false });
    expect(result?.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(result?.every((entry) => !Object.prototype.hasOwnProperty.call(entry, "values"))).toBe(true);
    expect(listSplitIds).toHaveBeenNthCalledWith(1, { limit: 100, order: "newest", cursor: undefined });
    expect(listSplitIds).toHaveBeenNthCalledWith(2, { limit: 100, order: "newest", cursor });
    expect(getFinancialProjectionsByIds).toHaveBeenNthCalledWith(1, ["a", "deleted"]);
  });

  it("discards a result if cancelled while a database read is pending", async () => {
    let release!: (value: unknown) => void;
    (listSplitIds as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    let cancelled = false;
    const scan = scanHomeBalances({ ownerName: "You", currency: "EUR", isCancelled: () => cancelled });
    cancelled = true;
    release({ records: [{ id: "a" }], nextCursor: null });
    expect(await scan).toBeNull();
    expect(getFinancialProjectionsByIds).not.toHaveBeenCalled();
  });

  it("reuses loaded records instead of reading them again", async () => {
    const loaded = record("loaded");
    (listSplitIds as jest.Mock).mockResolvedValueOnce({ records: [{ id: "loaded" }], nextCursor: null });
    const result = await scanHomeBalances({ ownerName: "You", currency: "EUR", isCancelled: () => false, getLoadedRecord: (id) => id === loaded.id ? loaded : undefined, cache: new WeakMap() });
    expect(result?.map((item) => item.id)).toEqual(["loaded"]);
    expect(getFinancialProjectionsByIds).not.toHaveBeenCalled();
  });

  it("propagates storage failures rather than reporting partial balances", async () => {
    (listSplitIds as jest.Mock).mockResolvedValueOnce({ records: [{ id: "a" }], nextCursor: null });
    (getFinancialProjectionsByIds as jest.Mock).mockRejectedValueOnce(new Error("read failed"));
    await expect(scanHomeBalances({ ownerName: "You", currency: "EUR", isCancelled: () => false })).rejects.toThrow("read failed");
  });
});
