import type { SQLiteDatabase } from "expo-sqlite";
import { withAppDatabaseRetry, withDatabaseTransaction } from "./database";
import {
  parseObject,
  readParticipants,
  type PersonMembership,
  type RawSplitRow,
} from "./personIdentity";
import { normalizePersonName } from "../features/split/people";

export const MEMBERSHIP_SCHEMA = `
  CREATE TABLE IF NOT EXISTS split_person_memberships (
    split_id TEXT NOT NULL REFERENCES split_records(id) ON DELETE CASCADE,
    participant_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    PRIMARY KEY (split_id, participant_id),
    UNIQUE (split_id, person_id)
  );
  CREATE INDEX IF NOT EXISTS split_person_memberships_by_person
    ON split_person_memberships (person_id, split_id);
`;

export async function replacePersonMemberships(
  tx: SQLiteDatabase,
  splitId: string,
  memberships: PersonMembership[],
) {
  const existing = await tx.getAllAsync<{ participant_id: string; person_id: string }>(
    "SELECT participant_id, person_id FROM split_person_memberships WHERE split_id = ?",
    [splitId],
  );
  const existingByParticipant = new Map(existing.map((entry) => [entry.participant_id, entry.person_id]));
  if (existing.length === memberships.length && memberships.every(
    (entry) => existingByParticipant.get(entry.participantId) === entry.personId,
  )) return;
  await tx.runAsync("DELETE FROM split_person_memberships WHERE split_id = ?", [
    splitId,
  ]);
  for (const membership of memberships) {
    await tx.runAsync(
      "INSERT INTO split_person_memberships (split_id, participant_id, person_id) VALUES (?, ?, ?)",
      [membership.splitId, membership.participantId, membership.personId],
    );
  }
}

export async function readRawSplitRows(db: SQLiteDatabase) {
  return db.getAllAsync<RawSplitRow>(
    "SELECT id, status, step, payload, created_at, updated_at, completed_at FROM split_records ORDER BY id",
  );
}

export function membershipsFromRows(rows: RawSplitRow[], people: Set<string>) {
  const memberships: PersonMembership[] = [];
  for (const row of rows) {
    const seen = new Set<string>();
    for (const participant of readParticipants(
      parseObject(row.payload, "split"),
    )) {
      if (
        !participant.personId ||
        !people.has(participant.personId) ||
        seen.has(participant.personId)
      )
        throw new Error("Invalid split identity coverage");
      seen.add(participant.personId);
      memberships.push({
        splitId: row.id,
        participantId: participant.id,
        personId: participant.personId,
      });
    }
  }
  return memberships;
}

export async function verifyPersonMemberships(
  db: SQLiteDatabase,
  expected?: PersonMembership[],
) {
  if (!expected) {
    const settings = await db.getFirstAsync<{ payload: string }>(
      "SELECT payload FROM app_settings WHERE key = ?",
      ["app-settings"],
    );
    const people =
      parseObject(settings?.payload ?? "{}", "settings").people ?? [];
    expected = membershipsFromRows(
      await readRawSplitRows(db),
      new Set(people.map((person: { id: string }) => person.id)),
    );
  }
  const actual = await db.getAllAsync<{
    split_id: string;
    participant_id: string;
    person_id: string;
  }>(
    "SELECT split_id, participant_id, person_id FROM split_person_memberships",
  );
  const key = (entry: PersonMembership) =>
    JSON.stringify([entry.splitId, entry.participantId, entry.personId]);
  const left = expected.map(key).sort();
  const right = actual
    .map((entry) =>
      key({
        splitId: entry.split_id,
        participantId: entry.participant_id,
        personId: entry.person_id,
      }),
    )
    .sort();
  if (JSON.stringify(left) !== JSON.stringify(right))
    throw new Error("Person membership index does not match split records");
}

export async function rebuildPersonMemberships() {
  await withDatabaseTransaction(async (tx) => {
    const row = await tx.getFirstAsync<{ payload: string }>(
      "SELECT payload FROM app_settings WHERE key = ?",
      ["app-settings"],
    );
    const people = parseObject(row?.payload ?? "{}", "settings").people ?? [];
    const memberships = membershipsFromRows(
      await readRawSplitRows(tx),
      new Set(people.map((person: { id: string }) => person.id)),
    );
    await tx.runAsync("DELETE FROM split_person_memberships");
    const splitIds = new Set(memberships.map((entry) => entry.splitId));
    for (const splitId of splitIds)
      await replacePersonMemberships(
        tx,
        splitId,
        memberships.filter((entry) => entry.splitId === splitId),
      );
    await verifyPersonMemberships(tx, memberships);
  });
}

export async function listRecordIdsForPerson(
  personId: string,
  status?: "draft" | "completed",
) {
  const rows = await withAppDatabaseRetry((db) =>
    db.getAllAsync<{ split_id: string }>(
      `SELECT m.split_id FROM split_person_memberships m JOIN split_records r ON r.id = m.split_id
     WHERE m.person_id = ?${status ? " AND r.status = ?" : ""} ORDER BY m.split_id`,
      status ? [personId, status] : [personId],
    ),
  );
  return rows.map((row) => row.split_id);
}

export async function countRecordsForPerson(
  personId: string,
  status?: "draft" | "completed",
) {
  const row = await withAppDatabaseRetry((db) =>
    db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM split_person_memberships m JOIN split_records r ON r.id = m.split_id
     WHERE m.person_id = ?${status ? " AND r.status = ?" : ""}`,
      status ? [personId, status] : [personId],
    ),
  );
  return row?.count ?? 0;
}

/** Include name-only legacy participants without transferring full split payloads. */
export async function listLegacyRecordIdsForPerson(name: string, ownerName: string) {
  const key = normalizePersonName(name).toLowerCase();
  if (!key) return [];
  const result: string[] = [];
  let lastId = "";
  while (true) {
    const rows = await withAppDatabaseRetry((db) => db.getAllAsync<{ id: string; participants: string }>(
      `SELECT id, CASE WHEN json_type(payload, '$.values') IS NOT NULL
        THEN json_extract(payload, '$.values.participants') ELSE json_extract(payload, '$.participants') END AS participants
       FROM split_records WHERE id > ? AND EXISTS (
         SELECT 1 FROM json_each(CASE WHEN json_type(payload, '$.values') IS NOT NULL
           THEN json_extract(payload, '$.values.participants') ELSE json_extract(payload, '$.participants') END) AS participant
         WHERE participant.type = 'object' AND (json_type(participant.value, '$.personId') IS NULL OR json_extract(participant.value, '$.personId') IS NULL OR json_extract(participant.value, '$.personId') = '')
       ) ORDER BY id LIMIT 100`,
      [lastId],
    ));
    for (const row of rows) {
      const participants = JSON.parse(row.participants) as { name?: unknown; personId?: unknown }[];
      if (participants.some((participant) => {
        if (participant.personId || typeof participant.name !== "string") return false;
        const alias = participant.name.trim().toLowerCase();
        return alias !== "you" && alias !== ownerName.trim().toLowerCase() && normalizePersonName(participant.name).toLowerCase() === key;
      })) result.push(row.id);
    }
    if (rows.length < 100) break;
    lastId = rows[rows.length - 1].id;
  }
  return result;
}

/** Project participant names in bounded batches for person-name validation. */
export async function listPersonNameConflicts(name: string, excludedPersonId: string | null | undefined, ownerAliasName?: string) {
  const nameKey = normalizePersonName(name).toLowerCase();
  const ownerKey = ownerAliasName?.trim().toLowerCase();
  const conflicts: { id: string; splitName: string }[] = [];
  let lastId = "";
  while (true) {
    const rows = await withAppDatabaseRetry((db) => db.getAllAsync<{ id: string; participants: string | null; split_name: unknown }>(
      `SELECT id,
        CASE WHEN json_type(payload, '$.values') IS NOT NULL THEN json_extract(payload, '$.values.participants') ELSE json_extract(payload, '$.participants') END AS participants,
        CASE WHEN json_type(payload, '$.values') IS NOT NULL THEN json_extract(payload, '$.values.splitName') ELSE json_extract(payload, '$.splitName') END AS split_name
       FROM split_records WHERE id > ? ORDER BY id LIMIT 100`,
      [lastId],
    ));
    for (const row of rows) {
      const participants: unknown = row.participants ? JSON.parse(row.participants) : [];
      if (!Array.isArray(participants)) throw new Error("Invalid split participants");
      const conflict = participants.some((participant: { name?: unknown; personId?: unknown }) => {
        if (!participant || participant.personId === excludedPersonId || typeof participant.name !== "string") return false;
        const alias = participant.name.trim().toLowerCase();
        return normalizePersonName(participant.name).toLowerCase() === nameKey || Boolean(ownerKey && (alias === ownerKey || alias === "you"));
      });
      if (conflict) conflicts.push({ id: row.id, splitName: typeof row.split_name === "string" ? row.split_name : "" });
    }
    if (rows.length < 100) break;
    lastId = rows[rows.length - 1].id;
  }
  return conflicts;
}
