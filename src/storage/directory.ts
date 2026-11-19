import type { SQLiteDatabase } from "expo-sqlite";
import type { ParticipantGroup, SavedPerson } from "../features/split/people";
import { withAppDatabaseRetry, withDatabaseTransaction } from "./database";
import { identityName } from "./personIdentity";

export const DIRECTORY_SCHEMA = `
  CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    photo_uri TEXT,
    color TEXT,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_owner INTEGER NOT NULL DEFAULT 0 CHECK (is_owner IN (0, 1)),
    profile_setup_completed INTEGER NOT NULL DEFAULT 0 CHECK (profile_setup_completed IN (0, 1)),
    CHECK (is_owner = 0 OR archived_at IS NULL)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS people_one_owner ON people (is_owner) WHERE is_owner = 1;
  CREATE TABLE IF NOT EXISTS participant_groups (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    description TEXT,
    photo_uri TEXT,
    icon TEXT,
    color TEXT,
    usage_count INTEGER NOT NULL CHECK (usage_count >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS participant_group_members (
    group_id TEXT NOT NULL REFERENCES participant_groups(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
    position INTEGER NOT NULL,
    PRIMARY KEY (group_id, person_id),
    UNIQUE (group_id, position)
  );
  CREATE INDEX IF NOT EXISTS participant_group_members_by_person
    ON participant_group_members (person_id, group_id);
`;

type PersonRow = SavedPerson & { isOwner: number; setupCompleted: number };

export async function readPeople(db: SQLiteDatabase): Promise<{
  people: SavedPerson[]; ownerPersonId?: string; profileSetupCompleted: boolean;
}> {
  const rows = await db.getAllAsync<PersonRow>(`
    SELECT id, name, photo_uri AS photoUri, color, archived_at AS archivedAt,
           created_at AS createdAt, updated_at AS updatedAt, is_owner AS isOwner,
           profile_setup_completed AS setupCompleted
    FROM people ORDER BY rowid
  `);
  return {
    people: rows.map(({ id, name, photoUri, color, archivedAt, createdAt, updatedAt }) => ({
      id, name, createdAt, updatedAt,
      ...(photoUri != null ? { photoUri } : {}),
      ...(color != null ? { color } : {}),
      ...(archivedAt != null ? { archivedAt } : {}),
    })),
    ownerPersonId: rows.find((row) => row.isOwner === 1)?.id,
    profileSetupCompleted: rows.some((row) => row.isOwner === 1 && row.setupCompleted === 1),
  };
}

export async function writePerson(db: SQLiteDatabase, person: SavedPerson) {
  const { id, name, photoUri, color, archivedAt, createdAt, updatedAt } = person;
  await db.runAsync(`
    INSERT INTO people (id, name, name_key, photo_uri, color, archived_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, name_key = excluded.name_key,
      photo_uri = excluded.photo_uri, color = excluded.color, archived_at = excluded.archived_at,
      updated_at = excluded.updated_at
  `, [id, name, identityName(name), photoUri ?? null, color ?? null, archivedAt ?? null, createdAt, updatedAt]);
}

export async function getPeople() {
  const directory = await withAppDatabaseRetry(readPeople);
  if (!directory.ownerPersonId) throw new Error("Missing owner identity");
  return directory;
}

export async function saveDirectoryPerson(person: SavedPerson) {
  await withDatabaseTransaction((tx) => writePerson(tx, person));
}

export async function readGroups(db: SQLiteDatabase): Promise<ParticipantGroup[]> {
  const rows = await db.getAllAsync<Omit<ParticipantGroup, "memberPersonIds"> & { personId: string | null }>(`
    SELECT g.id, g.name, g.description, g.photo_uri AS photoUri, g.icon, g.color,
           g.usage_count AS usageCount, g.created_at AS createdAt, g.updated_at AS updatedAt,
           m.person_id AS personId
    FROM participant_groups g LEFT JOIN participant_group_members m ON m.group_id = g.id
    ORDER BY g.rowid, m.position
  `);
  const groups = new Map<string, ParticipantGroup>();
  for (const { description, photoUri, icon, color, personId, ...row } of rows) {
    let group = groups.get(row.id);
    if (!group) {
      group = {
        ...row, memberPersonIds: [],
        ...(description != null ? { description } : {}),
        ...(photoUri != null ? { photoUri } : {}),
        ...(icon != null ? { icon } : {}),
        ...(color != null ? { color } : {}),
      };
      groups.set(row.id, group);
    }
    if (personId !== null) group.memberPersonIds.push(personId);
  }
  return [...groups.values()];
}

export const getGroups = () => withAppDatabaseRetry(readGroups);

export async function writeGroup(db: SQLiteDatabase, group: ParticipantGroup, previous?: ParticipantGroup) {
  const { id, name, description, photoUri, icon, color, usageCount, createdAt, updatedAt, memberPersonIds } = group;
  await db.runAsync(`
    INSERT INTO participant_groups (id, name, name_key, description, photo_uri, icon, color, usage_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, name_key = excluded.name_key,
      description = excluded.description, photo_uri = excluded.photo_uri, icon = excluded.icon,
      color = excluded.color, updated_at = excluded.updated_at
  `, [id, name, name.trim().toLowerCase(), description ?? null, photoUri ?? null, icon ?? null, color ?? null, usageCount, createdAt, updatedAt]);
  const previousMembers = previous?.memberPersonIds ?? [];
  for (const [position, personId] of previousMembers.entries()) {
    if (memberPersonIds[position] !== personId) {
      await db.runAsync("DELETE FROM participant_group_members WHERE group_id = ? AND person_id = ?", [id, personId]);
    }
  }
  for (const [position, personId] of memberPersonIds.entries()) {
    if (previousMembers[position] !== personId) {
      await db.runAsync("INSERT INTO participant_group_members (group_id, person_id, position) VALUES (?, ?, ?)", [id, personId, position]);
    }
  }
}

export async function deleteParticipantGroup(groupId: string) {
  await withDatabaseTransaction((tx) => tx.runAsync("DELETE FROM participant_groups WHERE id = ?", [groupId]));
}
