import type { SplitFormValues } from "../domain";
import { withAppDatabaseRetry } from "./database";

export type RecordStatus = "draft" | "completed";

export type DraftRecord = {
  id: string;
  status: RecordStatus;
  step: number;
  values: SplitFormValues;
  settlementState: {
    settledParticipantIds: string[];
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
};

export async function initializeRecordsStorage() {
  await withAppDatabaseRetry(async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS split_records (
        id TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL,
        step INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
    `);
  });
}

type DatabaseRow = {
  id: string;
  status: RecordStatus;
  step: number;
  payload: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

function isLegacyPlaceholderItem(item: any) {
  if (!item || typeof item !== "object") {
    return true;
  }

  const name = String(item.name ?? "").trim();
  const price = String(item.price ?? "").trim();
  const category = String(item.category ?? "").trim();

  return !price && !category && (name === "" || name.toLowerCase() === "item");
}

function getDefaultSettlementState() {
  return {
    settledParticipantIds: [] as string[],
  };
}

function mapRow(row: DatabaseRow): DraftRecord | null {
  let parsedPayload: SplitFormValues | { values?: SplitFormValues; settlementState?: { settledParticipantIds?: string[] } };
  try {
    parsedPayload = JSON.parse(row.payload) as SplitFormValues | { values?: SplitFormValues; settlementState?: { settledParticipantIds?: string[] } };
  } catch {
    console.warn(`Failed to parse record payload for record ${row.id}.`);
    return null;
  }
  const values =
    parsedPayload && typeof parsedPayload === "object" && "values" in parsedPayload
      ? (parsedPayload.values as SplitFormValues)
      : (parsedPayload as SplitFormValues);
  const items = Array.isArray(values.items) ? values.items.filter((item) => !isLegacyPlaceholderItem(item)) : [];
  const settlementState =
    parsedPayload &&
    typeof parsedPayload === "object" &&
    "settlementState" in parsedPayload &&
    parsedPayload.settlementState &&
    Array.isArray(parsedPayload.settlementState.settledParticipantIds)
      ? { settledParticipantIds: parsedPayload.settlementState.settledParticipantIds.filter((value) => typeof value === "string") }
      : getDefaultSettlementState();

  return {
    id: row.id,
    status: row.status,
    step: row.step,
    values: {
      ...values,
      splitName: typeof values.splitName === "string" ? values.splitName : "",
      items,
    },
    settlementState,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export async function listRecords() {
  const rows = await withAppDatabaseRetry((db) =>
    db.getAllAsync<DatabaseRow>(
      "SELECT id, status, step, payload, created_at, updated_at, completed_at FROM split_records ORDER BY updated_at DESC"
    )
  );
  return rows.map(mapRow).filter((row): row is DraftRecord => Boolean(row));
}

export async function getRecordById(id: string) {
  const row = await withAppDatabaseRetry((db) =>
    db.getFirstAsync<DatabaseRow>(
      "SELECT id, status, step, payload, created_at, updated_at, completed_at FROM split_records WHERE id = ?",
      [id]
    )
  );
  return row ? mapRow(row) : null;
}

export async function saveRecord(record: DraftRecord) {
  await withAppDatabaseRetry((db) =>
    db.runAsync(
      `INSERT OR REPLACE INTO split_records (id, status, step, payload, created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.status,
        record.step,
        JSON.stringify({
          values: record.values,
          settlementState: record.settlementState ?? getDefaultSettlementState(),
        }),
        record.createdAt,
        record.updatedAt,
        record.completedAt ?? null,
      ]
    )
  );
}

export async function deleteRecord(id: string) {
  await withAppDatabaseRetry((db) => db.runAsync("DELETE FROM split_records WHERE id = ?", [id]));
}
