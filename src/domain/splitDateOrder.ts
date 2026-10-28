import { localDay } from "./splitDate";

export interface SplitDateOrderedRecord {
  id: string;
  createdAt: string;
  values: { splitDate?: string };
}

export function compareSplitDates(left: SplitDateOrderedRecord, right: SplitDateOrderedRecord, newestFirst: boolean) {
  const leftDay = left.values.splitDate ?? localDay(new Date(left.createdAt));
  const rightDay = right.values.splitDate ?? localDay(new Date(right.createdAt));
  const result = leftDay.localeCompare(rightDay) || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
  return newestFirst ? -result : result;
}
