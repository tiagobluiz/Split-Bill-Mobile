import { listReminderRecordCandidates, reconcileReminderCandidate, type DraftRecord } from "../../storage/records";
import { hasReminderCleanup, reconcileScheduledReminders, type ReminderState } from "./reminders";

/** Reconcile unloaded records in bounded pages, without replacing unrelated edits. */
export async function reconcileStoredReminders(options: {
  isLoaded: (id: string) => boolean;
  onUpdated: (original: DraftRecord, reminderState: ReminderState) => boolean;
  onBatchChanged?: () => void;
}) {
  let cursor: string | undefined;
  let retry = false;
  let changed = false;
  do {
    const page = await listReminderRecordCandidates(cursor, 25);
    let batchChanged = false;
    try {
    for (const candidate of page.records) {
      if (!hasReminderCleanup(candidate.record)) continue;
      if (options.isLoaded(candidate.record.id)) { retry = true; continue; }
      const result = await reconcileReminderCandidate(candidate, () => !options.isLoaded(candidate.record.id), async (record) => {
        const reconciled = await reconcileScheduledReminders([record]);
        return reconciled.changed ? reconciled.records[0].reminderState ?? null : null;
      });
      if (result.status === "stale" || result.status === "skipped") retry = true;
      if (result.status === "updated") {
        changed = true;
        batchChanged = true;
        if (!options.onUpdated(candidate.record, result.reminderState)) retry = true;
      }
    }
    } finally {
      if (batchChanged) options.onBatchChanged?.();
    }
    cursor = page.nextCursor ?? undefined;
    if (cursor) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  } while (cursor);
  return { changed, retry };
}
