import type { DraftRecord } from "../../../../storage/records";
import type { SplitListAmountDisplay } from "../../../../storage/settings";
import { getRecordTitle } from "../../routes";
import { getSettlementPreview } from "../../store";
import { getRecentRowMeta } from "./settlementUtils";

export type RecordRowSettings = {
  defaultCurrency?: string;
  splitListAmountDisplay?: SplitListAmountDisplay;
  customCurrencies?: Array<{ code: string; name: string; symbol: string }>;
};

export type RecordRowModel = {
  id: string;
  title: string;
  status: DraftRecord["status"];
  tagIds: string[];
  meta: ReturnType<typeof getRecentRowMeta>;
};

/** Reduce a loaded split to the information needed by a list row. */
export function createRecordRowModel(record: DraftRecord, ownerName: string, settings: RecordRowSettings): RecordRowModel {
  return {
    id: record.id,
    title: getRecordTitle(record),
    status: record.status,
    tagIds: record.values.tagIds ?? [],
    meta: getRecentRowMeta(record, ownerName, settings, getSettlementPreview),
  };
}
