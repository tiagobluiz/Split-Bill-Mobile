import { act, renderHook, waitFor } from "@testing-library/react-native";
import { getRecordsByIds, type DraftRecord } from "../../../../storage/records";
import type { SplitListSummary } from "../../../../storage/splitList";
import { buildRecordFixture } from "../../integrationTestUtils";
import { usePageRowModels } from "./usePageRowModels";

jest.mock("../../../../storage/records", () => ({ getRecordsByIds: jest.fn() }));

const settings = { defaultCurrency: "EUR" };
const record = (id: string) => buildRecordFixture({ id }) as unknown as DraftRecord;
const summary = (id: string): SplitListSummary => ({ id, status: "draft", step: 1, splitName: id, firstItemName: "", currency: "EUR", tagIds: [], splitDate: "2026-01-01", createdAt: "2026-01-01", updatedAt: "2026-01-01", completedAt: null });
const noLoaded: DraftRecord[] = [];

describe("usePageRowModels", () => {
  beforeEach(() => jest.resetAllMocks());

  it("loads only newly requested page records and releases models when disabled", async () => {
    (getRecordsByIds as jest.Mock).mockImplementation(async (ids: string[]) => ids.map(record));
    const first = [summary("one")];
    const both = [...first, summary("two")];
    const { result, rerender } = renderHook(({ entries, enabled }) => usePageRowModels(entries, noLoaded, "Ana", settings, enabled), { initialProps: { entries: first, enabled: true } });
    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual(["one"]));
    rerender({ entries: both, enabled: true });
    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual(["one", "two"]));
    expect(getRecordsByIds).toHaveBeenNthCalledWith(1, ["one"]);
    expect(getRecordsByIds).toHaveBeenNthCalledWith(2, ["two"]);
    rerender({ entries: both, enabled: false });
    expect(result.current.rows).toEqual([]);
    rerender({ entries: first, enabled: true });
    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual(["one"]));
    expect(getRecordsByIds).toHaveBeenCalledTimes(3);
  });

  it("uses newer loaded edits and ignores a stale database result", async () => {
    let resolve!: (records: DraftRecord[]) => void;
    (getRecordsByIds as jest.Mock).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const entries = [summary("one")];
    const { result, rerender } = renderHook(({ loaded }) => usePageRowModels(entries, loaded, "Ana", settings, true), { initialProps: { loaded: noLoaded } });
    const edited = record("one");
    edited.values.splitName = "Updated dinner";
    rerender({ loaded: [edited] });
    await act(async () => resolve([record("one")]));
    expect(result.current.rows[0].title).toBe("Updated dinner");
  });

  it("retains the latest loaded row immediately when its record is released", async () => {
    const entries = [summary("one")];
    const loaded = record("one");
    loaded.values.splitName = "Edited dinner";
    const { result, rerender } = renderHook(({ records }) => usePageRowModels(entries, records, "Ana", settings, true), { initialProps: { records: [loaded] } });
    expect(result.current.rows[0].title).toBe("Edited dinner");
    rerender({ records: noLoaded });
    expect(result.current.rows[0].title).toBe("Edited dinner");
    expect(getRecordsByIds).not.toHaveBeenCalled();
  });

  it("handles deleted rows and allows retry after a read failure", async () => {
    (getRecordsByIds as jest.Mock).mockRejectedValueOnce(new Error("read failed")).mockResolvedValueOnce([]);
    const { result } = renderHook(() => usePageRowModels([summary("deleted")], noLoaded, "Ana", settings, true));
    await waitFor(() => expect(result.current.error).toBe(true));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.error).toBe(false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
  });
});
