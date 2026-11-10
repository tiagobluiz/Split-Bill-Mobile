import { act, renderHook, waitFor } from "@testing-library/react-native";

import { listSplitSummaries, type SplitListSummary } from "../../../../storage/splitList";
import { useSplitListPages } from "./useSplitListPages";
import { notifyArchiveChange } from "../../archiveChanges";

jest.mock("../../../../storage/splitList", () => ({ listSplitSummaries: jest.fn() }));

function summary(id: string): SplitListSummary {
  return { id, status: "completed", step: 6, splitName: id, firstItemName: "", currency: "EUR", tagIds: [], splitDate: "2026-01-01", createdAt: "2026-01-01", updatedAt: "2026-01-01", completedAt: null };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

describe("useSplitListPages", () => {
  beforeEach(() => jest.resetAllMocks());

  it("requests only five records for the Home preview", async () => {
    (listSplitSummaries as jest.Mock).mockResolvedValueOnce({ records: [summary("recent")], nextCursor: null });
    const { result } = renderHook(() => useSplitListPages({ order: "newest" }, 0, 5));
    await waitFor(() => expect(result.current.records).toHaveLength(1));
    expect(listSplitSummaries).toHaveBeenCalledWith({ order: "newest", limit: 5 });
  });

  it("refreshes visible metadata after background reminder reconciliation", async () => {
    const before = { ...summary("first"), splitReminder: { notificationId: "old", scheduledForIso: "2020-01-01", createdAt: "2020-01-01", updatedAt: "2020-01-01" } };
    (listSplitSummaries as jest.Mock)
      .mockResolvedValueOnce({ records: [before], nextCursor: null })
      .mockResolvedValueOnce({ records: [summary("first")], nextCursor: null });
    const { result } = renderHook(() => useSplitListPages({ order: "newest" }, 0));
    await waitFor(() => expect(result.current.records[0]).toEqual(before));
    act(() => notifyArchiveChange({ type: "metadata" }));
    await waitFor(() => expect(result.current.records[0]).toEqual(summary("first")));
  });

  it("loads the next page once and releases pages when the tab closes", async () => {
    const nextCursor = { id: "first", splitDate: "2026-01-01", createdAt: "2026-01-01" };
    const next = deferred<{ records: SplitListSummary[]; nextCursor: null }>();
    (listSplitSummaries as jest.Mock)
      .mockResolvedValueOnce({ records: [summary("first")], nextCursor })
      .mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(({ enabled }) => useSplitListPages(enabled ? { order: "newest" } : null, 0), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.records.map((record) => record.id)).toEqual(["first"]));
    act(() => { result.current.loadMore(); result.current.loadMore(); });
    expect(listSplitSummaries).toHaveBeenCalledTimes(2);
    await act(async () => { next.resolve({ records: [summary("second")], nextCursor: null }); await next.promise; });
    expect(result.current.records.map((record) => record.id)).toEqual(["first", "second"]);
    rerender({ enabled: false });
    await waitFor(() => expect(result.current.records).toEqual([]));
  });

  it("keeps loaded pages during record hydration and refreshes after an archive write", async () => {
    const nextCursor = { id: "first", splitDate: "2026-01-01", createdAt: "2026-01-01" };
    (listSplitSummaries as jest.Mock)
      .mockResolvedValueOnce({ records: [summary("first")], nextCursor })
      .mockResolvedValueOnce({ records: [summary("second")], nextCursor: null })
      .mockResolvedValueOnce({ records: [summary("updated")], nextCursor: null });
    const { result, rerender } = renderHook(({ records }) => {
      void records;
      return useSplitListPages({ order: "newest" }, null);
    }, { initialProps: { records: [] as string[] } });
    await waitFor(() => expect(result.current.records).toHaveLength(1));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.records.map((row) => row.id)).toEqual(["first", "second"]));
    rerender({ records: ["second"] });
    rerender({ records: [] });
    expect(result.current.records.map((row) => row.id)).toEqual(["first", "second"]);
    expect(listSplitSummaries).toHaveBeenCalledTimes(2);
    act(() => notifyArchiveChange({ type: "delete", id: "second" }));
    await waitFor(() => expect(result.current.records.map((row) => row.id)).toEqual(["updated"]));
  });

  it("ignores a page that finishes after the filters change", async () => {
    const old = deferred<{ records: SplitListSummary[]; nextCursor: null }>();
    const next = deferred<{ records: SplitListSummary[]; nextCursor: null }>();
    (listSplitSummaries as jest.Mock).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(({ status }) => useSplitListPages({ status }, 0), { initialProps: { status: "all" as "all" | "settled" } });
    rerender({ status: "settled" });
    await act(async () => { next.resolve({ records: [summary("new")], nextCursor: null }); await next.promise; });
    await act(async () => { old.resolve({ records: [summary("old")], nextCursor: null }); await old.promise; });
    expect(result.current.records.map((record) => record.id)).toEqual(["new"]);
  });

  it("keeps the cursor available when loading another page fails", async () => {
    const nextCursor = { id: "first", splitDate: "2026-01-01", createdAt: "2026-01-01" };
    (listSplitSummaries as jest.Mock)
      .mockResolvedValueOnce({ records: [summary("first")], nextCursor })
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce({ records: [summary("second")], nextCursor: null });
    const { result } = renderHook(() => useSplitListPages({ order: "newest" }, 0));
    await waitFor(() => expect(result.current.records).toHaveLength(1));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.records.map((record) => record.id)).toEqual(["first"]);
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.records.map((record) => record.id)).toEqual(["first", "second"]));
  });

  it("retries the first page after a storage failure", async () => {
    (listSplitSummaries as jest.Mock)
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce({ records: [summary("recovered")], nextCursor: null });
    const { result } = renderHook(() => useSplitListPages({ order: "newest" }, 0));
    await waitFor(() => expect(result.current.error).toBe(true));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.records.map((record) => record.id)).toEqual(["recovered"]));
    expect(result.current.error).toBe(false);
  });

  it("does not restore pages when an in-flight request finishes after leaving the tab", async () => {
    const page = deferred<{ records: SplitListSummary[]; nextCursor: null }>();
    (listSplitSummaries as jest.Mock).mockReturnValueOnce(page.promise);
    const { result, rerender } = renderHook(
      ({ enabled }) => useSplitListPages(enabled ? { order: "newest" } : null, 0),
      { initialProps: { enabled: true } },
    );
    rerender({ enabled: false });
    await act(async () => { page.resolve({ records: [summary("old")], nextCursor: null }); await page.promise; });
    expect(result.current.records).toEqual([]);
  });
});
