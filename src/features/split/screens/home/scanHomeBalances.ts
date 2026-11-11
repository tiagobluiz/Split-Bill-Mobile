import { getFinancialProjectionsByIds, type DraftRecord } from "../../../../storage/records";
import { listSplitIds, type SplitListCursor } from "../../../../storage/splitList";
import { getSettlementPreview } from "../../store";
import { getHomeBalanceEntry, getProjectedHomeBalanceEntry, type HomeBalanceCache, type HomeBalanceEntry } from "../shared/settlementUtils";

const BATCH_SIZE = 100;

/** Compute compact results in list order, retaining no full records between batches. */
export async function scanHomeBalances(options: {
  ownerName: string;
  currency: string;
  isCancelled: () => boolean;
  getLoadedRecord?: (id: string) => DraftRecord | undefined;
  cache?: HomeBalanceCache;
}): Promise<HomeBalanceEntry[] | null> {
  const entries: HomeBalanceEntry[] = [];
  let cursor: SplitListCursor | undefined;
  do {
    if (options.isCancelled()) return null;
    const page = await listSplitIds({ limit: BATCH_SIZE, cursor, order: "newest" });
    if (options.isCancelled()) return null;
    const loaded = new Map(page.records.flatMap((summary) => {
      const record = options.getLoadedRecord?.(summary.id);
      return record ? [[summary.id, record] as const] : [];
    }));
    const missingIds = page.records.filter((summary) => !loaded.has(summary.id)).map((summary) => summary.id);
    const fetched = missingIds.length ? await getFinancialProjectionsByIds(missingIds) : [];
    if (options.isCancelled()) return null;
    const fetchedById = new Map(fetched.map((row) => [row.id, row]));
    for (const summary of page.records) {
      const record = options.getLoadedRecord?.(summary.id) ?? loaded.get(summary.id);
      const projected = fetchedById.get(summary.id);
      if (record) entries.push(getHomeBalanceEntry(record, options.ownerName, options.currency, getSettlementPreview, options.cache));
      else if (projected) entries.push(getProjectedHomeBalanceEntry(projected, options.ownerName, options.currency));
    }
    cursor = page.nextCursor ?? undefined;
    if (cursor) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  } while (cursor);
  return options.isCancelled() ? null : entries;
}
