import { compareSplitDates } from "../domain/splitDateOrder";
import { normalizeTagIds } from "../features/split/tags";
import { normalizeReminderState, type ReminderEntry } from "../features/split/reminders";
import { withAppDatabaseRetry } from "./database";
import type { RecordStatus } from "./records";

// Keep this expression identical in the index and queries so SQLite can use it.
const RAW_DAY = "CASE WHEN json_type(payload, '$.values') IS NOT NULL THEN json_extract(payload, '$.values.splitDate') ELSE json_extract(payload, '$.splitDate') END";
const VALID_DAY = `CASE WHEN json_valid(payload) THEN CASE
  WHEN typeof(${RAW_DAY}) = 'text'
    AND ${RAW_DAY} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    AND CAST(substr(${RAW_DAY}, 1, 4) AS INTEGER) >= 100
    AND date(${RAW_DAY}, '+0 days') = ${RAW_DAY}
  THEN ${RAW_DAY} END END`;
const LEGACY_DAY = "COALESCE(strftime('%Y-%m-%d', created_at, 'localtime'), 'NaN-NaN-NaN')";
const TAGS = `CASE WHEN json_type(payload, '$.values') IS NOT NULL THEN
  CASE WHEN json_type(payload, '$.values.tagIds') = 'array' THEN json_extract(payload, '$.values.tagIds') ELSE '[]' END
  ELSE CASE WHEN json_type(payload, '$.tagIds') = 'array' THEN json_extract(payload, '$.tagIds') ELSE '[]' END END`;
const JS_WHITESPACE = "char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)";
const ITEMS = `CASE WHEN json_type(payload, '$.values') IS NOT NULL THEN
  CASE WHEN json_type(payload, '$.values.items') = 'array' THEN json_extract(payload, '$.values.items') ELSE '[]' END
  ELSE CASE WHEN json_type(payload, '$.items') = 'array' THEN json_extract(payload, '$.items') ELSE '[]' END END`;
const FIRST_ITEM_NAME = `(SELECT json_extract(item.value, '$.name') FROM json_each(${ITEMS}) AS item
  WHERE item.type = 'object' AND (
    trim(COALESCE(CAST(json_extract(item.value, '$.price') AS TEXT), ''), ${JS_WHITESPACE}) != '' OR
    trim(COALESCE(CAST(json_extract(item.value, '$.category') AS TEXT), ''), ${JS_WHITESPACE}) != '' OR
    (trim(COALESCE(CAST(json_extract(item.value, '$.name') AS TEXT), ''), ${JS_WHITESPACE}) != '' AND
      lower(trim(COALESCE(CAST(json_extract(item.value, '$.name') AS TEXT), ''), ${JS_WHITESPACE})) != 'item')
  ) LIMIT 1)`;

export const SPLIT_LIST_INDEX_SCHEMA = `
  CREATE INDEX IF NOT EXISTS split_records_list_day
  ON split_records (${VALID_DAY} DESC, created_at DESC, id DESC)
  WHERE ${VALID_DAY} IS NOT NULL;
  CREATE INDEX IF NOT EXISTS split_records_list_legacy
  ON split_records (created_at DESC, id DESC)
  WHERE ${VALID_DAY} IS NULL;
`;

export type SplitListCursor = { splitDate: string; createdAt: string; id: string };
export type SplitListSummary = SplitListCursor & {
  status: RecordStatus;
  step: number;
  updatedAt: string;
  completedAt: string | null;
  splitName: string;
  firstItemName: string;
  currency: string;
  tagIds: string[];
  splitReminder?: ReminderEntry;
};
export type SplitListQuery = {
  limit: number;
  cursor?: SplitListCursor;
  order?: "newest" | "oldest";
  status?: "all" | "settled" | "unsettled";
  tagIds?: string[];
  tagMode?: "all" | "any";
  eligibleIds?: string[];
  excludedId?: string;
};

/** Count stored splits using a tag, excluding loaded records supplied as an overlay. */
export async function countSplitTagUsage(tagId: string, excludedIds: readonly string[] = []) {
  const row = await withAppDatabaseRetry((db) => db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM split_records WHERE id NOT IN (SELECT value FROM json_each(?) WHERE type = 'text')
     AND EXISTS (SELECT 1 FROM json_each(${TAGS}) AS tag WHERE tag.type = 'text' AND trim(tag.value, ${JS_WHITESPACE}) = ?)`,
    [JSON.stringify(excludedIds), tagId],
  ));
  return row?.count ?? 0;
}

export type SplitParticipantProjection = { id: string; values: { participants: Array<{ name: string; personId?: string }> } };

/** Load participant names without transferring item allocations or full payloads. */
export async function getSplitParticipantsByIds(ids: readonly string[]): Promise<SplitParticipantProjection[]> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return [];
  if (uniqueIds.length > 100) throw new Error("Participant batch exceeds 100 IDs");
  const rows = await withAppDatabaseRetry((db) => db.getAllAsync<{ id: string; participants: string | null }>(
    `SELECT id, CASE WHEN json_type(payload, '$.values') IS NOT NULL THEN json_extract(payload, '$.values.participants') ELSE json_extract(payload, '$.participants') END AS participants
     FROM split_records WHERE id IN (SELECT value FROM json_each(?) WHERE type = 'text')`,
    [JSON.stringify(uniqueIds)],
  ));
  const byId = new Map(rows.map((row) => {
    const participants: unknown = row.participants ? JSON.parse(row.participants) : null;
    if (!Array.isArray(participants) || participants.some((entry) => !entry || typeof entry.name !== "string")) throw new Error(`Invalid split participants (${row.id})`);
    return [row.id, { id: row.id, values: { participants } } as SplitParticipantProjection] as const;
  }));
  return uniqueIds.flatMap((id) => { const row = byId.get(id); return row ? [row] : []; });
}

type SummaryRow = {
  id: string;
  status: RecordStatus;
  step: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  split_day: string;
  split_name: unknown;
  first_item_name: unknown;
  currency: unknown;
  tags: string;
  split_reminder: unknown;
};

function compare(left: SplitListCursor, right: SplitListCursor, newest: boolean) {
  return compareSplitDates(
    { id: left.id, createdAt: left.createdAt, values: { splitDate: left.splitDate } },
    { id: right.id, createdAt: right.createdAt, values: { splitDate: right.splitDate } },
    newest,
  );
}

/** Read a page of compact metadata without transferring full split payloads. */
export async function listSplitSummaries(query: SplitListQuery) {
  return listSplitPage(query, false) as Promise<{ records: SplitListSummary[]; nextCursor: SplitListCursor | null }>;
}

/** Read only ordering keys for archive-wide background scans. */
export async function listSplitIds(query: SplitListQuery) {
  return listSplitPage(query, true) as Promise<{ records: SplitListCursor[]; nextCursor: SplitListCursor | null }>;
}

async function listSplitPage(query: SplitListQuery, cursorOnly: boolean) {
  const limit = Math.max(1, Math.min(100, Math.trunc(query.limit) || 20));
  const newest = query.order !== "oldest";
  const direction = newest ? "DESC" : "ASC";
  const comparison = newest ? "<" : ">";
  const tags = normalizeTagIds(query.tagIds);
  if (query.eligibleIds && query.eligibleIds.length === 0) return { records: [], nextCursor: null };

  const filters: string[] = [];
  const filterArgs: (string | number)[] = [];
  if (query.status === "settled") filters.push("status = 'completed'");
  if (query.status === "unsettled") filters.push("status != 'completed'");
  if (query.excludedId) { filters.push("id != ?"); filterArgs.push(query.excludedId); }
  if (query.eligibleIds) {
    filters.push("id IN (SELECT value FROM json_each(?) WHERE type = 'text')");
    filterArgs.push(JSON.stringify(query.eligibleIds));
  }
  if (tags.length) {
    const matches = tags.map(() => `EXISTS (SELECT 1 FROM json_each(${TAGS}) AS tag WHERE tag.type = 'text' AND trim(tag.value, ${JS_WHITESPACE}) = ?)`);
    filters.push(`(${matches.join(query.tagMode === "any" ? " OR " : " AND ")})`);
    filterArgs.push(...tags);
  }

  return withAppDatabaseRetry(async (db) => {
    const select = (day: string) => cursorOnly ? `SELECT id, created_at, ${day} AS split_day FROM split_records` : `SELECT id, status, step, created_at, updated_at, completed_at,
      ${day} AS split_day,
      CASE WHEN json_type(payload, '$.values') IS NOT NULL THEN json_extract(payload, '$.values.splitName') ELSE json_extract(payload, '$.splitName') END AS split_name,
      CASE WHEN json_type(payload, '$.values') IS NOT NULL THEN json_extract(payload, '$.values.currency') ELSE json_extract(payload, '$.currency') END AS currency,
      ${TAGS} AS tags, ${FIRST_ITEM_NAME} AS first_item_name,
      json_extract(payload, '$.reminderState.splitReminder') AS split_reminder FROM split_records`;
    const toSummary = (row: SummaryRow): SplitListSummary | SplitListCursor => {
      if (cursorOnly) return { id: row.id, createdAt: row.created_at, splitDate: row.split_day };
      let reminder: unknown;
      try { reminder = typeof row.split_reminder === "string" ? JSON.parse(row.split_reminder) : row.split_reminder; } catch { reminder = undefined; }
      const splitReminder = normalizeReminderState({ splitReminder: reminder }).splitReminder;
      return {
        id: row.id, status: row.status, step: row.step, createdAt: row.created_at,
        updatedAt: row.updated_at, completedAt: row.completed_at, splitDate: row.split_day,
        splitName: typeof row.split_name === "string" ? row.split_name : "",
        firstItemName: typeof row.first_item_name === "string" ? row.first_item_name : "",
        currency: typeof row.currency === "string" ? row.currency : "",
        tagIds: normalizeTagIds(JSON.parse(row.tags)),
        ...(splitReminder ? { splitReminder } : {}),
      };
    };

    const readPartition = async (valid: boolean) => {
      const day = valid ? VALID_DAY : LEGACY_DAY;
      const base = [`${VALID_DAY} IS ${valid ? "NOT " : ""}NULL`, ...filters];
      const args = [...filterArgs];
      if (query.cursor) {
        base.push(`(${day} ${comparison} ? OR (${day} = ? AND created_at ${comparison} ?))`);
        args.push(query.cursor.splitDate, query.cursor.splitDate, query.cursor.createdAt);
      }
      const rows = await db.getAllAsync<SummaryRow>(`${select(day)} WHERE ${base.join(" AND ")}
        ORDER BY ${day} ${direction}, created_at ${direction}, id ${direction} LIMIT ?`, [...args, limit + 1]);

      // SQLite's binary ID ordering differs from localeCompare for some legacy IDs.
      // Read complete timestamp ties, then order and paginate those ties in JS.
      const groups = new Map<string, { day: string; createdAt: string }>();
      const boundary = rows[rows.length - 1];
      if (boundary) groups.set(`${boundary.split_day}\u0000${boundary.created_at}`, { day: boundary.split_day, createdAt: boundary.created_at });
      if (query.cursor) groups.set(`${query.cursor.splitDate}\u0000${query.cursor.createdAt}`, { day: query.cursor.splitDate, createdAt: query.cursor.createdAt });
      const tied = await Promise.all([...groups.values()].map((group) => db.getAllAsync<SummaryRow>(
        `${select(day)} WHERE ${[`${VALID_DAY} IS ${valid ? "NOT " : ""}NULL`, ...filters, `${day} = ?`, "created_at = ?"].join(" AND ")}`,
        [...filterArgs, group.day, group.createdAt],
      )));
      const unique = new Map([...rows, ...tied.flat()].map((row) => [row.id, toSummary(row)]));
      return [...unique.values()].filter((record) => !query.cursor || compare(record, query.cursor, newest) > 0);
    };

    const partitions = await Promise.all([readPartition(true), readPartition(false)]);
    const ordered = partitions.flat().sort((left, right) => compare(left, right, newest));
    const records = ordered.slice(0, limit);
    const last = records[records.length - 1];
    return {
      records,
      nextCursor: ordered.length > limit && last
        ? { id: last.id, splitDate: last.splitDate, createdAt: last.createdAt }
        : null,
    };
  });
}
