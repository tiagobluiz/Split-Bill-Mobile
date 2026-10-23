import type { SplitFormValues } from "../domain";
import type { SQLiteDatabase } from "expo-sqlite";
import { withAppDatabaseRetry, withDatabaseTransaction } from "./database";
import { MEMBERSHIP_SCHEMA, replacePersonMemberships } from "./personMemberships";
import { parseObject, readParticipants, planPersonIdentity, type IdentifiedParticipant, type RawSplitRow } from "./personIdentity";
import type { AppSettings } from "./settings";
import {
  createEmptyReminderState,
  normalizeReminderState,
  type ReminderState,
} from "../features/split/reminders";
import { normalizeTagIds } from "../features/split/tags";
import { createGroup, createPerson, mergePeopleRegistry, normalizeGroupName, normalizePersonName, normalizePeople, normalizeGroups, type SavedPerson, type ParticipantGroup } from "../features/split/people";

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
      ${MEMBERSHIP_SCHEMA}
    `);
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
    const items = Array.isArray(values.items) ? values.items.filter((item) => !isLegacyPlaceholderItem(item)) : [];
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

function toRawRow(record: DraftRecord): RawSplitRow {
  return { id: record.id, status: record.status, step: record.step,
    payload: JSON.stringify({ values: record.values, settlementState: record.settlementState ?? getDefaultSettlementState(), reminderState: record.reminderState ?? getDefaultReminderState() }),
    created_at: record.createdAt, updated_at: record.updatedAt, completed_at: record.completedAt ?? null };
}

async function writeRecords(tx: SQLiteDatabase, records: DraftRecord[], suppliedSettings?: AppSettings, pendingPeople: AppSettings["people"] = [], restorePersonIds: string[] = [], incrementGroupUsageId?: string) {
  const settingsRow = await tx.getFirstAsync<{ payload: string }>("SELECT payload FROM app_settings WHERE key = ?", ["app-settings"]);
  const original = settingsRow ? parseObject(settingsRow.payload, "settings") : {};
  const proposed = suppliedSettings ? {
    ...original,
    ...suppliedSettings,
    ...(original.people !== undefined || suppliedSettings.people !== undefined
      ? { people: mergePeopleRegistry(original.people, suppliedSettings.people) }
      : {}),
  } : original;
  if (restorePersonIds.length) {
    const restoreIds = new Set(restorePersonIds);
    proposed.people = (Array.isArray(proposed.people) ? proposed.people : []).map((person: SavedPerson) =>
      restoreIds.has(person.id) ? { ...person, archivedAt: null, updatedAt: new Date().toISOString() } : person,
    );
    const foundIds = new Set((proposed.people as SavedPerson[]).map((person) => person.id));
    if (restorePersonIds.some((id) => !foundIds.has(id))) throw new Error("Cannot restore a missing person");
  }
  if (pendingPeople?.length) {
    const people = Array.isArray(proposed.people) ? proposed.people : [];
    const knownIds = new Set(people.map((person: { id: string }) => person.id));
    proposed.people = [...people, ...pendingPeople.filter((person) => !knownIds.has(person.id))];
  }
  if (incrementGroupUsageId) {
    const groups = normalizeGroups(proposed.participantGroups, proposed.people);
    const group = groups.find((entry) => entry.id === incrementGroupUsageId);
    if (!group) throw new Error("Cannot increment usage for a missing group");
    proposed.participantGroups = groups.map((entry) => entry.id === group.id
      ? { ...entry, usageCount: entry.usageCount + 1, updatedAt: new Date().toISOString() }
      : entry);
  }
  const validIds = new Set((proposed.people ?? []).map((person: { id: string }) => person.id));
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
  const existingReferences = await tx.getAllAsync<{ person_id: string }>("SELECT DISTINCT person_id FROM split_person_memberships");
  const nextIds = new Set(plan.settings.people.map((person) => person.id));
  if (existingReferences.some((reference) => !nextIds.has(reference.person_id))) throw new Error("Cannot remove a referenced person");
  await tx.runAsync("INSERT INTO app_settings (key, payload) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload", ["app-settings", JSON.stringify(plan.settings)]);
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
    identified.push(mapRow(row as DatabaseRow) as IdentifiedRecord);
  }
  return { records: identified, settings: plan.settings as unknown as AppSettings };
}

export async function savePersonAndLinkedRecords(person: SavedPerson, selectedGroupIds: string[], requireExisting: boolean) {
  return withDatabaseTransaction(async (tx) => {
    const settingsRow = await tx.getFirstAsync<{ payload: string }>("SELECT payload FROM app_settings WHERE key = ?", ["app-settings"]);
    const stored = settingsRow ? parseObject(settingsRow.payload, "settings") : {};
    const people = normalizePeople(stored.people);
    const current = people.find((entry) => entry.id === person.id);
    if (requireExisting && !current) throw new Error("Person no longer exists");
    if (!current && people.some((entry) => entry.id === person.id)) throw new Error("Person ID already exists");
    const normalizedName = normalizePersonName(person.name).toLowerCase();
    if (people.some((entry) => entry.id !== person.id && normalizePersonName(entry.name).toLowerCase() === normalizedName)) {
      throw new Error("Person name conflicts with another saved person");
    }
    const groups = normalizeGroups(stored.participantGroups, people);
    const selected = new Set(selectedGroupIds);
    const nextGroups = groups.map((group) => {
      const hasPerson = group.memberPersonIds.includes(person.id);
      const wantsPerson = selected.has(group.id);
      if (hasPerson && !wantsPerson && group.memberPersonIds.length === 1) throw new Error("Cannot remove the last group member");
      if (hasPerson === wantsPerson) return group;
      return {
        ...group,
        memberPersonIds: wantsPerson ? [...group.memberPersonIds, person.id] : group.memberPersonIds.filter((id) => id !== person.id),
        updatedAt: person.updatedAt,
      };
    });
    const finalPerson = current ? { ...current, ...person } : person;
    const nextSettings = { ...stored, people: current ? people.map((entry) => entry.id === person.id ? finalPerson : entry) : [...people, finalPerson], participantGroups: nextGroups };
    await tx.runAsync("INSERT INTO app_settings (key, payload) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload", ["app-settings", JSON.stringify(nextSettings)]);

    const rows = await tx.getAllAsync<DatabaseRow>(`SELECT r.id, r.status, r.step, r.payload, r.created_at, r.updated_at, r.completed_at
      FROM split_person_memberships m JOIN split_records r ON r.id = m.split_id WHERE m.person_id = ?`, [person.id]);
    const updatedRecords: DraftRecord[] = [];
    for (const row of rows) {
      const payload = parseObject(row.payload, "split");
      const values = (payload.values ?? payload) as SplitFormValues;
      let changed = false;
      const participants = values.participants.map((participant) => {
        if (participant.personId !== person.id || participant.name === person.name) return participant;
        changed = true;
        return { ...participant, name: person.name };
      });
      if (!changed) continue;
      const nextPayload = JSON.stringify("values" in payload
        ? { ...payload, values: { ...values, participants } }
        : { ...payload, participants });
      await tx.runAsync("UPDATE split_records SET payload = ?, updated_at = ? WHERE id = ?", [nextPayload, person.updatedAt, row.id]);
      const updated = mapRow({ ...row, payload: nextPayload, updated_at: person.updatedAt });
      if (updated) updatedRecords.push(updated);
    }
    return { settings: nextSettings as unknown as AppSettings, records: updatedRecords };
  });
}

export async function saveRecordsAndSettings(records: DraftRecord[], settings?: AppSettings, pendingPeople: AppSettings["people"] = [], restorePersonIds: string[] = [], incrementGroupUsageId?: string) {
  return withDatabaseTransaction((tx) => writeRecords(tx, records, settings, pendingPeople, restorePersonIds, incrementGroupUsageId));
}

export async function saveRecord(record: DraftRecord, pendingPeople: AppSettings["people"] = [], restorePersonIds: string[] = [], incrementGroupUsageId?: string) {
  const saved = await saveRecordsAndSettings([record], undefined, pendingPeople, restorePersonIds, incrementGroupUsageId);
  return { record: saved.records[0], settings: saved.settings };
}

export async function saveParticipantGroup(
  groupId: string | null,
  input: Partial<ParticipantGroup> & { name: string; memberPersonIds: string[]; newPersonNames?: string[] },
) {
  return withDatabaseTransaction(async (tx) => {
    const row = await tx.getFirstAsync<{ payload: string }>("SELECT payload FROM app_settings WHERE key = ?", ["app-settings"]);
    const stored = row ? parseObject(row.payload, "settings") : {};
    const people = normalizePeople(stored.people);
    const groups = normalizeGroups(stored.participantGroups, people);
    const name = normalizeGroupName(input.name);
    if (!name || groups.some((group) => group.id !== groupId && normalizeGroupName(group.name).toLowerCase() === name.toLowerCase())) return null;
    const existingGroup = groupId ? groups.find((group) => group.id === groupId) : undefined;
    if (groupId && !existingGroup) return null;

    const ownerName = normalizePersonName(String(stored.ownerName ?? "You")).toLowerCase();
    if ((input.newPersonNames ?? []).some((rawName) => {
      const candidate = normalizePersonName(rawName).toLowerCase();
      return candidate && (candidate === ownerName || candidate === "you");
    })) return null;

    const nextPeople = [...people];
    const memberIds = new Set(input.memberPersonIds.map((id) => id.trim()).filter(Boolean));
    for (const rawName of input.newPersonNames ?? []) {
      const personName = normalizePersonName(rawName);
      if (!personName) continue;
      const nameKey = personName.toLowerCase();
      const existing = nextPeople.find((person) => normalizePersonName(person.name).toLowerCase() === nameKey);
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
    const nextGroups = normalizeGroups(
      existingGroup ? groups.map((entry) => entry.id === group.id ? group : entry) : [...groups, group],
      nextPeople,
    );
    const nextSettings = { ...stored, people: nextPeople, participantGroups: nextGroups };
    await tx.runAsync("INSERT INTO app_settings (key, payload) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload", ["app-settings", JSON.stringify(nextSettings)]);
    return {
      settings: nextSettings as unknown as AppSettings,
      group,
      restoredPersonIds: people.filter((person) => person.archivedAt && nextPeople.some((next) => next.id === person.id && !next.archivedAt)).map((person) => person.id),
      createdPeople: nextPeople.filter((person) => !people.some((existing) => existing.id === person.id)),
    };
  });
}

export async function deleteRecord(id: string) {
  await withDatabaseTransaction(async (tx) => {
    await tx.runAsync("DELETE FROM split_person_memberships WHERE split_id = ?", [id]);
    await tx.runAsync("DELETE FROM split_records WHERE id = ?", [id]);
  });
}
