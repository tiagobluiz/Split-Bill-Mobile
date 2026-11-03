import { useEffect, useRef, useState } from "react";

export function useTimedUndoNotice<T>(
  restore: (item: T) => Promise<void>,
  restoredMessage: string,
  restoreFailedMessage: string,
) {
  const [message, setMessage] = useState("");
  const [pendingItem, setPendingItem] = useState<T | null>(null);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => {
      setMessage("");
      setPendingItem(null);
    }, pendingItem ? 5000 : 2200);
    return () => clearTimeout(timeout);
  }, [message, pendingItem]);

  const notify = (nextMessage: string, undoItem?: T) => {
    setMessage(nextMessage);
    setPendingItem(undoItem ?? null);
  };

  const undo = async () => {
    if (pendingItem === null) return;
    const item = pendingItem;
    setPendingItem(null);
    try {
      await restoreRef.current(item);
      setMessage(restoredMessage);
    } catch {
      setMessage(restoreFailedMessage);
    }
  };

  return { message, canUndo: pendingItem !== null, notify, undo };
}
