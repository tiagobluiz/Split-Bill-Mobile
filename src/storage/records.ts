import { createId, validatePersonName, type SplitFormValues } from "../domain";
import { isValidSplitDate, localDay } from "../domain/splitDate";
import { compareSplitDates } from "../domain/splitDateOrder";
import type { SQLiteDatabase } from "expo-sqlite";
import { withAppDatabaseRetry, withDatabaseTransaction } from "./database";
import { replacePersonMemberships } from "./personMemberships";
import { SPLIT_LIST_INDEX_SCHEMA } from "./splitList";
import { createFinancialProjection, type FinancialProjection } from "./financialProjection";
import { identityName, parseObject, readParticipants, planPersonIdentity, type IdentifiedParticipant, type RawSplitRow } from "./personIdentity";
import { writeAppSettings, type AppSettings } from "./settings";
import { readGroups, readPeople, writeGroup, writePerson } from "./directory";
import {
  createEmptyReminderState,
  normalizeReminderState,
  type ReminderState,
} from "../features/split/reminders";
import { normalizeTagIds } from "../features/split/tags";
import { createGroup, createPerson, normalizeGroupName, normalizePersonName, normalizeGroups, type SavedPerson, type ParticipantGroup } from "../features/split/people";

export type RecordStatus = "draft" | "completed";

export type DraftRecord = {
  id: string;
  status: RecordStatus;
  step: number;
  values: SplitFormValues;
  settlementState: {
    settledParticipantIds: string[];
  };
  reminderState?: ReminderState;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
};

export type IdentifiedRecord = Omit<DraftRecord, "values"> & {
  values: Omit<SplitFormValues, "participants"> & { participants: IdentifiedParticipant[] };
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
      ${SPLIT_LIST_INDEX_SCHEMA}
    `);
    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(split_records)");
    if (!columns.some((column) => column.name === "financial_projection")) {
      await db.execAsync("ALTER TABLE split_records ADD COLUMN financial_projection TEXT");
    }
  });
}

export type DatabaseRow = {
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

function getDefaultReminderState() {
  return createEmptyReminderState();
}

function describePayloadShape(value: unknown) {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value !== "object") {
    return typeof value;
  }
  return Object.keys(value as Record<string, unknown>).join(",");
}

function logRecordMappingFailure(
  row: DatabaseRow,
  error: unknown,
  parsedPayload?: unknown,
) {
  console.error(
    "[Split Bill storage] failed to map split record",
    JSON.stringify({
      id: row.id,
      status: row.status,
      step: row.step,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      payloadShape: describePayloadShape(parsedPayload),
      payloadLength: row.payload.length,
    }),
    error,
  );
}

function mapRow(row: DatabaseRow): DraftRecord | null {
  let parsedPayload:
    | SplitFormValues
    | {
        values?: SplitFormValues;
        settlementState?: { settledParticipantIds?: string[] };
        reminderState?: ReminderState;
      };
  try {
    parsedPayload = JSON.parse(row.payload) as SplitFormValues | { values?: SplitFormValues; settlementState?: { settledParticipantIds?: string[] } };
  } catch {
    throw new Error(`Invalid split record payload (${row.id})`);
  }
  try {
    const values =
      parsedPayload && typeof parsedPayload === "object" && "values" in parsedPayload
        ? (parsedPayload.values as SplitFormValues)
        : (parsedPayload as SplitFormValues);
    const seenItemIds = new Set<string>();
    const reservedItemIds = new Set(
      Array.isArray(values.items)
        ? values.items.filter((item) => !isLegacyPlaceholderItem(item)).map((item) => item.id)
        : [],
    );
    const items = Array.isArray(values.items)
      ? values.items.filter((item) => !isLegacyPlaceholderItem(item)).map((item, itemIndex) => {
          if (!seenItemIds.has(item.id)) {
            seenItemIds.add(item.id);
            return item;
          }
          const repairedIdBase = `${row.id}-item-${itemIndex}`;
          let repairedId = repairedIdBase;
          let suffix = 2;
          while (reservedItemIds.has(repairedId) || seenItemIds.has(repairedId)) {
            repairedId = `${repairedIdBase}-${suffix}`;
            suffix += 1;
          }
          const repairedItem = { ...item, id: repairedId };
          reservedItemIds.add(repairedId);
          seenItemIds.add(repairedItem.id);
          return repairedItem;
        })
      : [];
    const settlementState =
      parsedPayload &&
      typeof parsedPayload === "object" &&
      "settlementState" in parsedPayload &&
      parsedPayload.settlementState &&
      Array.isArray(parsedPayload.settlementState.settledParticipantIds)
        ? { settledParticipantIds: parsedPayload.settlementState.settledParticipantIds.filter((value) => typeof value === "string") }
        : getDefaultSettlementState();
    const reminderState =
      parsedPayload &&
      typeof parsedPayload === "object" &&
      "reminderState" in parsedPayload
        ? normalizeReminderState(parsedPayload.reminderState)
        : getDefaultReminderState();

    return {
      id: row.id,
      status: row.status,
      step: row.step,
      values: {
        ...values,
        splitName: typeof values.splitName === "string" ? values.splitName : "",
        splitDate: isValidSplitDate(values.splitDate) ? values.splitDate : localDay(new Date(row.created_at)),
        tagIds: normalizeTagIds((values as { tagIds?: unknown }).tagIds),
        items,
      },
      settlementState,
      reminderState,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  } catch (error) {
    logRecordMappingFailure(row, error, parsedPayload);
    throw error;
  }
}

export async function listRecords() {
  const rows = await withAppDatabaseRetry((db) =>
    db.getAllAsync<DatabaseRow>(
      "SELECT id, status, step, payload, created_at, updated_at, completed_at FROM split_records"
    )
  );
  return rows.map(mapRow).filter((row): row is DraftRecord => Boolean(row)).sort((left, right) => compareSplitDates(left, right, true));
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

/** Load only the records in a visible or background-processing batch. */
export async function getRecordsByIds(ids: readonly string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return [];
  if (uniqueIds.length > 100) throw new Error("Record batch exceeds 100 IDs");
  const rows = await withAppDatabaseRetry((db) =>
    db.getAllAsync<DatabaseRow>(
      "SELECT id, status, step, payload, created_at, updated_at, completed_at FROM split_records WHERE id IN (SELECT value FROM json_each(?) WHERE type = 'text')",
      [JSON.stringify(uniqueIds)],
    ),
  );
  const recordsById = new Map(rows.map(mapRow).filter((row): row is DraftRecord => Boolean(row)).map((row) => [row.id, row]));
  return uniqueIds.flatMap((id) => {
    const record = recordsById.get(id);
    return record ? [record] : [];
  });
}

/** Read compact financial data and backfill older rows in bounded transactions. */
export async function getFinancialProjectionsByIds(ids: readonly string[]) {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return [];
  if (uniqueIds.length > 100) throw new Error("Financial projection batch exceeds 100 IDs");
  type ProjectionRow = DatabaseRow & { financial_projection: string | null };
  const rows = await withAppDatabaseRetry((db) => db.getAllAsync<ProjectionRow>(
    `SELECT id, status, step, created_at, updated_at, completed_at, financial_projection,
      CASE WHEN financial_projection IS NULL THEN payload ELSE NULL END AS payload
      FROM split_records WHERE id IN (SELECT value FROM json_each(?) WHERE type = 'text')`,
    [JSON.stringify(uniqueIds)],
  ));
  const projections = new Map<string, { id: string; createdAt: string; projection: FinancialProjection }>();
  const missing: Array<{ row: ProjectionRow; projection: FinancialProjection }> = [];
  for (const row of rows) {
    const projection = row.financial_projection === null
      ? createFinancialProjection(mapRow(row)!)
      : JSON.parse(row.financial_projection) as FinancialProjection;
    if (projection.version !== 1) throw new Error(`Unsupported financial projection (${row.id})`);
    projections.set(row.id, { id: row.id, createdAt: row.created_at, projection });
    if (row.financial_projection === null) missing.push({ row, projection });
  }
  if (missing.length) {
    const staleIds = await withDatabaseTransaction(async (tx) => {
      const stale: string[] = [];
      for (const { row, projection } of missing) {
        const result = await tx.runAsync(
          "UPDATE split_records SET financial_projection = ? WHERE id = ? AND payload = ? AND financial_projection IS NULL",
          [JSON.stringify(projection), row.id, row.payload],
        );
        if (result.changes !== 1) stale.push(row.id);
      }
      return stale;
    });
    for (const id of staleIds) {
      const current = await getRecordById(id);
      if (current) projections.set(id, { id, createdAt: current.createdAt, projection: createFinancialProjection(current) });
      else projections.delete(id);
    }
  }
  return uniqueIds.flatMap((id) => projections.has(id) ? [projections.get(id)!] : []);
}

export type ReminderRecordCandidate = { record: DraftRecord; rawPayload: string };

/** Read bounded batches of records that may have reminders requiring reconciliation. */
export async function listReminderRecordCandidates(afterId?: string, limit = 25) {
  const bounded = Math.max(1, Math.min(100, Math.trunc(limit) || 25));
  const rows = await withAppDatabaseRetry((db) => db.getAllAsync<DatabaseRow>(
    `SELECT id, status, step, payload, created_at, updated_at, completed_at FROM split_records
     WHERE id > ? AND json_valid(payload) AND json_type(payload, '$.values') IS NOT NULL AND (
       json_type(payload, '$.reminderState.splitReminder') = 'object' OR
       (json_type(payload, '$.reminderState.participantDebtReminders') IN ('object', 'array') AND EXISTS (SELECT 1 FROM json_each(payload, '$.reminderState.participantDebtReminders')))
     ) ORDER BY id LIMIT ?`,
    [afterId ?? "", bounded + 1],
  ));
  const page = rows.slice(0, bounded);
  return {
    records: page.map((row) => ({ record: mapRow(row)!, rawPayload: row.payload })),
    nextCursor: rows.length > bounded ? page[page.length - 1].id : null,
  };
}

/** Replace only reminder metadata if no other write changed the split since it was read. */
export async function replaceReminderStateIfUnchanged(id: string, rawPayload: string, reminderState: ReminderState) {
  const payload = parseObject(rawPayload, "split");
  if (!("values" in payload)) throw new Error("Cannot reconcile an unwrapped split reminder");
  const next = JSON.stringify({ ...payload, reminderState });
  return withDatabaseTransaction(async (tx) => {
    const result = await tx.runAsync("UPDATE split_records SET payload = ? WHERE id = ? AND payload = ?", [next, id, rawPayload]);
    return result.changes === 1;
  });
}

/** Recheck a candidate under the write lock before cancelling its notifications. */
export async function reconcileReminderCandidate(
  candidate: ReminderRecordCandidate,
  shouldProcess: () => boolean,
  reconcile: (record: DraftRecord) => Promise<ReminderState | null>,
) {
  return withDatabaseTransaction(async (tx) => {
    const current = await tx.getFirstAsync<{ payload: string }>("SELECT payload FROM split_records WHERE id = ?", [candidate.record.id]);
    if (!current || current.payload !== candidate.rawPayload) return { status: "stale" as const };
    if (!shouldProcess()) return { status: "skipped" as const };
    const reminderState = await reconcile(candidate.record);
    if (!reminderState) return { status: "unchanged" as const };
    const payload = parseObject(current.payload, "split");
    if (!("values" in payload)) throw new Error("Cannot reconcile an unwrapped split reminder");
    const result = await tx.runAsync("UPDATE split_records SET payload = ? WHERE id = ? AND payload = ?", [JSON.stringify({ ...payload, reminderState }), candidate.record.id, current.payload]);
    return result.changes === 1 ? { status: "updated" as const, reminderState } : { status: "stale" as const };
  });
}

function toRawRow(record: DraftRecord): RawSplitRow {
  return { id: record.id, status: record.status, step: record.step,
    payload: JSON.stringify({ values: record.values, settlementState: record.settlementState ?? getDefaultSettlementState(), reminderState: record.reminderState ?? getDefaultReminderState() }),
    created_at: record.createdAt, updated_at: record.updatedAt, completed_at: record.completedAt ?? null };
}

async function writeRecords(tx: SQLiteDatabase, records: DraftRecord[], pendingPeople: SavedPerson[] = [], restorePersonIds: string[] = [], incrementGroupUsageId?: string) {
  const directory = await readPeople(tx);
  const owner = directory.people.find((person) => person.id === directory.ownerPersonId);
  if (!owner) throw new Error("Missing owner identity");
  const proposed = { people: directory.people, ownerName: owner.name, ownerPersonId: owner.id };
  if (restorePersonIds.length) {
    const restoreIds = new Set(restorePersonIds);
    proposed.people = proposed.people.map((person) =>
      restoreIds.has(person.id) ? { ...person, archivedAt: null, updatedAt: new Date().toISOString() } : person,
    );
    const foundIds = new Set(proposed.people.map((person) => person.id));
    if (restorePersonIds.some((id) => !foundIds.has(id))) throw new Error("Cannot restore a missing person");
  }
  if (pendingPeople.length) {
    const knownIds = new Set(proposed.people.map((person) => person.id));
    proposed.people = [...proposed.people, ...pendingPeople.filter((person) => !knownIds.has(person.id))];
  }
  const validIds = new Set(proposed.people.map((person) => person.id));
  for (const record of records) for (const participant of record.values.participants) {
    if (participant.personId && !validIds.has(participant.personId)) throw new Error("Split references a missing person");
  }
  for (const record of records) {
    const previous = await tx.getFirstAsync<{ payload: string }>("SELECT payload FROM split_records WHERE id = ?", [record.id]);
    const identified = previous ? new Map(readParticipants(parseObject(previous.payload, "split")).map((entry) => [entry.id, entry.personId])) : new Map<string, string>();
    if (record.values.participants.some((entry) => !entry.personId && identified.get(entry.id))) {
      throw new Error("An existing participant identity cannot be omitted");
    }
  }
  const plan = planPersonIdentity(proposed, records.map(toRawRow), undefined, undefined, true);
  const originalById = new Map(directory.people.map((person) => [person.id, person]));
  const changedPeople = plan.settings.people.filter((person) => {
    const original = originalById.get(person.id);
    return !original || original.archivedAt !== person.archivedAt;
  });
  for (const person of changedPeople) await writePerson(tx, person);
  let groupUsage: { id: string; usageCount: number; updatedAt: string } | null = null;
  if (incrementGroupUsageId) {
    await tx.runAsync("UPDATE participant_groups SET usage_count = usage_count + 1, updated_at = ? WHERE id = ?",
      [new Date().toISOString(), incrementGroupUsageId]);
    groupUsage = await tx.getFirstAsync<{ id: string; usageCount: number; updatedAt: string }>(
      "SELECT id, usage_count AS usageCount, updated_at AS updatedAt FROM participant_groups WHERE id = ?",
      [incrementGroupUsageId],
    );
    if (!groupUsage) throw new Error("Cannot increment usage for a missing group");
  }
  const identified: IdentifiedRecord[] = [];
  const membershipsBySplit = new Map<string, typeof plan.memberships>();
  for (const membership of plan.memberships) {
    const entries = membershipsBySplit.get(membership.splitId) ?? [];
    entries.push(membership); membershipsBySplit.set(membership.splitId, entries);
  }
  for (const row of plan.rows) {
    await tx.runAsync(`INSERT INTO split_records (id, status, step, payload, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
      status = excluded.status, step = excluded.step, payload = excluded.payload,
      created_at = excluded.created_at, updated_at = excluded.updated_at, completed_at = excluded.completed_at`,
    [row.id, row.status, row.step, row.payload, row.created_at, row.updated_at, row.completed_at]);
    await replacePersonMemberships(tx, row.id, membershipsBySplit.get(row.id) ?? []);
    const savedRecord = mapRow(row as DatabaseRow) as IdentifiedRecord;
    await tx.runAsync("UPDATE split_records SET financial_projection = ? WHERE id = ?", [JSON.stringify(createFinancialProjection(savedRecord)), row.id]);
    identified.push(savedRecord);
  }
  return { records: identified, people: changedPeople, groupUsage };
}

export type OwnerProfilePatch = {
  ownerName?: string;
  ownerProfileImageUri?: string;
  profileSetupCompleted?: boolean;
  color?: SavedPerson["color"];
  groupIds?: string[];
};

async function writePersonAndLinkedRecords(
  tx: SQLiteDatabase,
  person: SavedPerson,
  current: SavedPerson | undefined,
  selectedGroupIds?: string[],
) {
  await writePerson(tx, person);
  const changedGroups: ParticipantGroup[] = [];
  if (selectedGroupIds) {
    const selected = new Set(selectedGroupIds);
    for (const group of await readGroups(tx)) {
      const hasPerson = group.memberPersonIds.includes(person.id);
      const wantsPerson = selected.has(group.id);
      if (hasPerson === wantsPerson) continue;
      if (!wantsPerson && group.memberPersonIds.length === 1) throw new Error("Cannot remove the last group member");
      const updated = {
        ...group,
        memberPersonIds: wantsPerson ? [...group.memberPersonIds, person.id] : group.memberPersonIds.filter((id) => id !== person.id),
        updatedAt: person.updatedAt,
      };
      await writeGroup(tx, updated, group);
      changedGroups.push(updated);
    }
  }
  if (!current || current.name === person.name) return changedGroups;

  let cursor = "";
  while (true) {
    const rows = await tx.getAllAsync<DatabaseRow>(
      `SELECT r.id, r.status, r.step, r.payload, r.created_at, r.updated_at, r.completed_at
       FROM split_person_memberships m JOIN split_records r ON r.id = m.split_id
       WHERE m.person_id = ? AND r.id > ? ORDER BY r.id LIMIT 100`, [person.id, cursor],
    );
    for (const row of rows) {
      const payload = parseObject(row.payload, "split");
      const wrapped = "values" in payload;
      const values = (wrapped ? payload.values : payload) as SplitFormValues;
      if (!values.participants.some((entry) => entry.personId === person.id && entry.name !== person.name)) continue;
      const participants = values.participants.map((entry) =>
        entry.personId === person.id ? { ...entry, name: person.name } : entry,
      );
      const nextValues = { ...values, participants };
      const serialized = JSON.stringify(wrapped ? { ...payload, values: nextValues } : nextValues);
      const updated = mapRow({ ...row, payload: serialized, updated_at: person.updatedAt });
      await tx.runAsync("UPDATE split_records SET payload = ?, updated_at = ?, financial_projection = ? WHERE id = ?", [
        serialized, person.updatedAt, updated ? JSON.stringify(createFinancialProjection(updated)) : null, row.id,
      ]);
    }
    if (rows.length < 100) break;
    cursor = rows[rows.length - 1].id;
  }
  return changedGroups;
}

export async function savePersonAndLinkedRecords(person: SavedPerson, selectedGroupIds: string[], requireExisting: boolean) {
  return withDatabaseTransaction(async (tx) => {
    const { people, ownerPersonId } = await readPeople(tx);
    const current = people.find((entry) => entry.id === person.id);
    if (Boolean(current) !== requireExisting) throw new Error(current ? "Person ID already exists" : "Person no longer exists");
    if (person.id === ownerPersonId) throw new Error("Use the owner profile action");
    const validation = validatePersonName(person.name, people, person.id);
    if (validation) throw new Error(validation.reason === "duplicate" ? "Person name conflicts with another saved person" : "Invalid person name");
    const groups = await writePersonAndLinkedRecords(tx, person, current, selectedGroupIds);
    return { person, groups };
  });
}

export async function saveOwnerProfileAndLinkedRecords(patch: OwnerProfilePatch) {
  return withDatabaseTransaction(async (tx) => {
    const { people, ownerPersonId, profileSetupCompleted } = await readPeople(tx);
    const current = people.find((entry) => entry.id === ownerPersonId);
    if (!current) throw new Error("Missing owner identity");
    if (patch.ownerName !== undefined && (patch.ownerName !== current.name || patch.profileSetupCompleted)) {
      const validation = validatePersonName(patch.ownerName, people, current.id);
      if (validation) throw new Error(validation.reason === "duplicate" ? "Owner name conflicts with a saved person" : "Invalid owner name");
    }
    const owner = {
      ...current,
      name: patch.ownerName ?? current.name,
      ...(patch.ownerProfileImageUri !== undefined ? { photoUri: patch.ownerProfileImageUri.trim() || null } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      updatedAt: new Date().toISOString(),
    };
    const groups = await writePersonAndLinkedRecords(tx, owner, current, patch.groupIds);
    const completed = profileSetupCompleted || patch.profileSetupCompleted === true;
    if (completed !== profileSetupCompleted) {
      await tx.runAsync("UPDATE people SET profile_setup_completed = 1 WHERE id = ?", [owner.id]);
    }
    return { owner, groups, profileSetupCompleted: completed };
  });
}

/** Remove a tag from settings and every stored split in the same transaction. */
export async function removeSplitTagAndUpdateSettings(tagId: string, settings: AppSettings) {
  return withDatabaseTransaction(async (tx) => {
    await writeAppSettings(tx, { tags: settings.tags });
    let lastId = "";
    const whitespace = "char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)";
    const tags = "CASE WHEN json_type(payload, '$.values') IS NOT NULL THEN CASE WHEN json_type(payload, '$.values.tagIds') = 'array' THEN json_extract(payload, '$.values.tagIds') ELSE '[]' END ELSE CASE WHEN json_type(payload, '$.tagIds') = 'array' THEN json_extract(payload, '$.tagIds') ELSE '[]' END END";
    while (true) {
      const rows = await tx.getAllAsync<{ id: string; payload: string }>(
        `SELECT id, payload FROM split_records WHERE id > ? AND EXISTS (SELECT 1 FROM json_each(${tags}) AS tag WHERE tag.type = 'text' AND trim(tag.value, ${whitespace}) = ?) ORDER BY id LIMIT 100`,
        [lastId, tagId],
      );
      for (const row of rows) {
        const payload = parseObject(row.payload, "split");
        const wrapped = "values" in payload;
        const values = wrapped ? payload.values : payload;
        const tagIds = normalizeTagIds(values.tagIds, settings.tags).filter((id) => id !== tagId);
        const nextPayload = wrapped ? { ...payload, values: { ...values, tagIds } } : { ...payload, tagIds };
        await tx.runAsync("UPDATE split_records SET payload = ?, updated_at = ? WHERE id = ?", [JSON.stringify(nextPayload), new Date().toISOString(), row.id]);
      }
      if (rows.length < 100) break;
      lastId = rows[rows.length - 1].id;
    }
  });
}

export async function saveRecord(record: DraftRecord, pendingPeople: SavedPerson[] = [], restorePersonIds: string[] = [], incrementGroupUsageId?: string) {
  const saved = await withDatabaseTransaction((tx) => writeRecords(tx, [record], pendingPeople, restorePersonIds, incrementGroupUsageId));
  return { record: saved.records[0], people: saved.people, groupUsage: saved.groupUsage };
}

export async function saveParticipantGroup(
  groupId: string | null,
  input: Partial<ParticipantGroup> & { name: string; memberPersonIds: string[]; newPersonNames?: string[] },
) {
  return withDatabaseTransaction(async (tx) => {
    const { people, ownerPersonId } = await readPeople(tx);
    const ownerName = people.find((person) => person.id === ownerPersonId)?.name ?? "You";
    const groups = await readGroups(tx);
    const name = normalizeGroupName(input.name);
    if (!name || groups.some((group) => group.id !== groupId && normalizeGroupName(group.name).toLowerCase() === name.toLowerCase())) return null;
    const existingGroup = groupId ? groups.find((group) => group.id === groupId) : undefined;
    if (groupId && !existingGroup) return null;

    const ownerKey = identityName(ownerName);
    if ((input.newPersonNames ?? []).some((rawName) => {
      const candidate = identityName(rawName);
      return candidate && (candidate === ownerKey || candidate === "you");
    })) return null;

    const nextPeople = [...people];
    const memberIds = new Set(input.memberPersonIds.map((id) => id.trim()).filter(Boolean));
    for (const rawName of input.newPersonNames ?? []) {
      if (validatePersonName(rawName)) return null;
      const personName = normalizePersonName(rawName);
      if (!personName) continue;
      const nameKey = identityName(personName);
      const existing = nextPeople.find((person) => identityName(person.name) === nameKey);
      if (existing) {
        memberIds.add(existing.id);
        if (existing.archivedAt) {
          const index = nextPeople.findIndex((person) => person.id === existing.id);
          nextPeople[index] = { ...existing, archivedAt: null, updatedAt: new Date().toISOString() };
        }
      } else {
        const created = createPerson(personName);
        if (created) {
          nextPeople.push(created);
          memberIds.add(created.id);
        }
      }
    }
    const validMemberIds = [...memberIds].filter((id) => nextPeople.some((person) => person.id === id));
    if (!validMemberIds.length) return null;
    const timestamp = new Date().toISOString();
    const appearance = {
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.photoUri !== undefined ? { photoUri: input.photoUri } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    };
    const group = existingGroup
      ? { ...existingGroup, ...appearance, id: existingGroup.id, name, memberPersonIds: validMemberIds, usageCount: existingGroup.usageCount, createdAt: existingGroup.createdAt, updatedAt: timestamp }
      : (() => {
          const created = createGroup(name, validMemberIds);
          return created ? { ...created, ...appearance, name, memberPersonIds: validMemberIds } : null;
        })();
    if (!group) return null;
    const [savedGroup] = normalizeGroups([group], nextPeople);
    if (!savedGroup) return null;
    const previousPeople = new Map(people.map((person) => [person.id, person]));
    const changedPeople = nextPeople.filter((person) => previousPeople.get(person.id) !== person);
    for (const person of changedPeople) await writePerson(tx, person);
    await writeGroup(tx, savedGroup, existingGroup);
    return { group: savedGroup, people: changedPeople };
  });
}

export async function deleteRecord(id: string) {
  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync("DELETE FROM split_records WHERE id = ?", [id]);
  });
}
