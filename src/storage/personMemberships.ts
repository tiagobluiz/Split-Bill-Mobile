import type { SQLiteDatabase } from "expo-sqlite";
import { withAppDatabaseRetry, withDatabaseTransaction } from "./database";
import {
  parseObject,
  readParticipants,
  type PersonMembership,
  type RawSplitRow,
} from "./personIdentity";

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
