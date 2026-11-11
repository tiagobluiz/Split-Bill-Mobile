import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { DraftRecord } from "../../../../storage/records";
import type { AppSettings } from "../../../../storage/settings";
import { notifyArchiveChange } from "../../archiveChanges";
import { scanFrequentFriends } from "./scanFrequentFriends";
import { useFrequentFriends } from "./useFrequentFriends";

jest.mock("expo-router", () => ({ useFocusEffect: (callback: () => void) => require("react").useEffect(callback, [callback]) }));
jest.mock("./scanFrequentFriends", () => ({ scanFrequentFriends: jest.fn() }));

const settings = { ownerName: "You", people: [] } as unknown as AppSettings;
const records: DraftRecord[] = [];
const friend = (name: string) => ({ name, selected: false, background: "#fff", foreground: "#000" });
const draft = (id: string) => ({ id } as DraftRecord);

describe("useFrequentFriends", () => {
  beforeEach(() => jest.resetAllMocks());

  it("ignores a scan that completes after switching drafts", async () => {
    let finishOld!: (value: ReturnType<typeof friend>[]) => void;
    (scanFrequentFriends as jest.Mock)
      .mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }))
      .mockResolvedValueOnce([friend("New")]);
    const { result, rerender } = renderHook(({ id }) => useFrequentFriends(id, records, settings), { initialProps: { id: "old" } });
    rerender({ id: "new" });
    await waitFor(() => expect(result.current.friends?.map((item) => item.name)).toEqual(["New"]));
    await act(async () => finishOld([friend("Old")]));
    expect(result.current.friends?.map((item) => item.name)).toEqual(["New"]);
  });

  it("refreshes after other history changes but not edits to the active draft", async () => {
    (scanFrequentFriends as jest.Mock).mockResolvedValueOnce([friend("Ana")]).mockResolvedValueOnce([friend("Bruno")]);
    const { result } = renderHook(() => useFrequentFriends("current", records, settings));
    await waitFor(() => expect(result.current.friends?.[0].name).toBe("Ana"));
    act(() => notifyArchiveChange({ type: "upsert", record: draft("current") }));
    expect(scanFrequentFriends).toHaveBeenCalledTimes(1);
    act(() => notifyArchiveChange({ type: "delete", id: "old" }));
    await waitFor(() => expect(result.current.friends?.[0].name).toBe("Bruno"));
  });

  it("shows failure and retries the history scan", async () => {
    (scanFrequentFriends as jest.Mock).mockRejectedValueOnce(new Error("read failed")).mockResolvedValueOnce([friend("Ana")]);
    const { result } = renderHook(() => useFrequentFriends("current", records, settings));
    await waitFor(() => expect(result.current.error).toBe(true));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.friends?.[0].name).toBe("Ana"));
  });
});
