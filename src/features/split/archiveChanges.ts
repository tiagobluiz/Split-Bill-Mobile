import type { DraftRecord } from "../../storage/records";

export type ArchiveChange =
  | { type: "upsert"; record: DraftRecord }
  | { type: "delete"; id: string }
  | { type: "metadata" }
  | { type: "invalidate" };

const listeners = new Set<(change: ArchiveChange) => void>();

export function subscribeArchiveChanges(listener: (change: ArchiveChange) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifyArchiveChange(change: ArchiveChange) {
  for (const listener of listeners) {
    try { listener(change); } catch (error) { console.warn("Archive change listener failed", error); }
  }
}
