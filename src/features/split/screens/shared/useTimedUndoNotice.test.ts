import { act, renderHook } from "@testing-library/react-native";
import { useTimedUndoNotice } from "./useTimedUndoNotice";

describe("useTimedUndoNotice", () => {
  it.each(["success", "failure"])("keeps a newer notice when an earlier restore ends in %s", async (result) => {
    let finish!: () => void;
    let fail!: (error: Error) => void;
    const restore = jest.fn(() => new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; }));
    const { result: hook } = renderHook(() => useTimedUndoNotice(restore, "Restored", "Failed"));
    act(() => hook.current.notify("First deleted", "first"));
    let pending!: Promise<void>;
    act(() => { pending = hook.current.undo(); });
    act(() => hook.current.notify("Second deleted", "second"));
    await act(async () => {
      if (result === "success") finish(); else fail(new Error("offline"));
      await pending;
    });
    expect(hook.current.message).toBe("Second deleted");
    expect(hook.current.canUndo).toBe(true);
    act(() => { void hook.current.undo(); });
    expect(restore).toHaveBeenLastCalledWith("second");
  });
});
