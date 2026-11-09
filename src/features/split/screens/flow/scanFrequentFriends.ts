import type { DraftRecord } from "../../../../storage/records";
import { getSplitParticipantsByIds, listSplitIds, type SplitListCursor } from "../../../../storage/splitList";
import { FREQUENT_ENTRY_LIMIT, type SavedPerson } from "../../people";
import { createFrequentFriendsAccumulator } from "../shared/participantUtils";

export async function scanFrequentFriends(options: {
  activeDraftId: string;
  ownerName: string;
  ownerPersonId?: string;
  people: SavedPerson[];
  getLoadedRecord?: (id: string) => DraftRecord | undefined;
  isCancelled: () => boolean;
}) {
  const accumulator = createFrequentFriendsAccumulator(options.activeDraftId, options.ownerName, { people: options.people, ownerPersonId: options.ownerPersonId, limit: FREQUENT_ENTRY_LIMIT });
  let cursor: SplitListCursor | undefined;
  do {
    if (options.isCancelled()) return null;
    const page = await listSplitIds({ order: "newest", excludedId: options.activeDraftId, limit: 50, cursor });
    if (options.isCancelled()) return null;
    const loaded = new Map(page.records.flatMap((summary) => {
      const record = options.getLoadedRecord?.(summary.id);
      return record ? [[summary.id, record] as const] : [];
    }));
    const missing = page.records.filter((summary) => !loaded.has(summary.id)).map((summary) => summary.id);
    const projections = missing.length ? await getSplitParticipantsByIds(missing) : [];
    if (options.isCancelled()) return null;
    const byId = new Map(projections.map((record) => [record.id, record]));
    for (const summary of page.records) {
      const record = options.getLoadedRecord?.(summary.id) ?? loaded.get(summary.id) ?? byId.get(summary.id);
      if (record) accumulator.add(record);
    }
    cursor = page.nextCursor ?? undefined;
    if (cursor) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  } while (cursor);
  return options.isCancelled() ? null : accumulator.finish();
}
