import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
import { DIRECTORY_SCHEMA, writePerson } from "./directory";
import { runIsolatedTransaction, withDatabaseWrite } from "./database";
import {
  assertIdentityOnlyChange,
  parseObject,
  planPersonIdentity,
  type RawSplitRow,
} from "./personIdentity";
import {
  MEMBERSHIP_SCHEMA,
  readRawSplitRows,
  replacePersonMemberships,
  verifyPersonMemberships,
} from "./personMemberships";

export const PERSON_IDENTITY_VERSION = 1;
export const PERSON_IDENTITY_BACKUP =
  "split-bill-mobile.before-person-identity-v1.db";

async function readSnapshot(db: SQLite.SQLiteDatabase) {
  const settings = await db.getAllAsync<{ key: string; payload: string }>(
    "SELECT key, payload FROM app_settings ORDER BY key",
  );
  return { settings, rows: await readRawSplitRows(db) };
}

async function assertIntegrity(db: SQLite.SQLiteDatabase) {
  const rows = await db.getAllAsync<{ integrity_check: string }>(
    "PRAGMA integrity_check",
  );
  if (rows.length !== 1 || rows[0].integrity_check !== "ok")
    throw new Error("Database integrity verification failed");
}

async function ensureVerifiedBackup(
  db: SQLite.SQLiteDatabase,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
) {
  const directory = SQLite.defaultDatabaseDirectory;
  if (!directory)
    throw new Error("Persistent SQLite backup is unavailable on this platform");
  const baseUri = directory.startsWith("file://")
    ? directory
    : `file://${directory}`;
  const uri = `${baseUri.replace(/\/$/, "")}/${PERSON_IDENTITY_BACKUP}`;
  const exists = (await FileSystem.getInfoAsync(uri)).exists;
  const backupName = exists
    ? PERSON_IDENTITY_BACKUP
    : `${PERSON_IDENTITY_BACKUP}.pending`;
  const pendingUri = `${uri}.pending`;
  if (!exists) await FileSystem.deleteAsync(pendingUri, { idempotent: true });
  const backup = await SQLite.openDatabaseAsync(backupName, {
    useNewConnection: true,
  });
  try {
    if (!exists)
      await SQLite.backupDatabaseAsync({
        sourceDatabase: db,
        destDatabase: backup,
      });
    await assertIntegrity(backup);
    if (JSON.stringify(await readSnapshot(backup)) !== JSON.stringify(snapshot))
      throw new Error("Migration backup does not match source data");
  } finally {
    await backup.closeAsync();
  }
  if (!exists) await FileSystem.moveAsync({ from: pendingUri, to: uri });
}

function originalSettings(snapshot: Awaited<ReturnType<typeof readSnapshot>>) {
  const row = snapshot.settings.find((entry) => entry.key === "app-settings");
  return row ? parseObject(row.payload, "settings") : {};
}

async function writeMigration(
  tx: SQLite.SQLiteDatabase,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
  plan: ReturnType<typeof planPersonIdentity>,
  hasBackup: boolean,
) {
  if (JSON.stringify(await readSnapshot(tx)) !== JSON.stringify(snapshot))
    throw new Error("Data changed during migration preparation");
  const original = originalSettings(snapshot);
  const owner = plan.settings.people.find((person) => person.id === plan.settings.ownerPersonId)!;
  const photoUri = typeof original.ownerProfileImageUri === "string" ? original.ownerProfileImageUri.trim() : "";
  const profileSetupCompleted = typeof original.profileSetupCompleted === "boolean"
    ? original.profileSetupCompleted : owner.name.toLocaleLowerCase() !== "you";
  for (const person of plan.settings.people) {
    await writePerson(tx, person.id === owner.id ? { ...person, photoUri: photoUri || null } : person);
  }
  await tx.runAsync("UPDATE people SET is_owner = 1, profile_setup_completed = ? WHERE id = ?", [
    Number(profileSetupCompleted), owner.id,
  ]);
  if (snapshot.settings.some((entry) => entry.key === "app-settings")) {
    const preferences = { ...original };
    for (const key of ["ownerName", "ownerProfileImageUri", "profileSetupCompleted",
      "ownerPersonId", "people", "participantGroups"]) delete preferences[key];
    await tx.runAsync("UPDATE app_settings SET payload = ? WHERE key = ?", [
      JSON.stringify(preferences), "app-settings",
    ]);
  }
  const bySplit = new Map<string, typeof plan.memberships>();
  for (const membership of plan.memberships) {
    const entries = bySplit.get(membership.splitId) ?? [];
    entries.push(membership);
    bySplit.set(membership.splitId, entries);
  }
  for (const row of plan.rows) {
    await tx.runAsync("UPDATE split_records SET payload = ? WHERE id = ?", [
      row.payload,
      row.id,
    ]);
    await replacePersonMemberships(tx, row.id, bySplit.get(row.id) ?? []);
  }
  const actual = await readRawSplitRows(tx);
  assertIdentityOnlyChange(snapshot.rows, actual);
  await verifyPersonMemberships(tx, plan.memberships);
  if ((await tx.getAllAsync("PRAGMA foreign_key_check")).length)
    throw new Error("Migration foreign key verification failed");
  await tx.runAsync(
    "INSERT INTO identity_migrations (version, completed_at, audit) VALUES (?, ?, ?)",
    [
      PERSON_IDENTITY_VERSION,
      new Date().toISOString(),
      JSON.stringify({
        splitCount: plan.rows.length,
        participantCount: plan.memberships.length,
        personCount: plan.settings.people.length,
        backup: hasBackup ? PERSON_IDENTITY_BACKUP : null,
      }),
    ],
  );
}

export async function migratePersonIdentity() {
  return withDatabaseWrite(async (db) => {
    await db.execAsync(`${DIRECTORY_SCHEMA}
      ${MEMBERSHIP_SCHEMA}
      CREATE TABLE IF NOT EXISTS identity_migrations (version INTEGER PRIMARY KEY NOT NULL, completed_at TEXT NOT NULL, audit TEXT NOT NULL);`);
    const completed = await db.getFirstAsync<{ version: number }>(
      "SELECT version FROM identity_migrations WHERE version = ?",
      [PERSON_IDENTITY_VERSION],
    );
    if (completed) return;
    const started = Date.now();
    const snapshot = await readSnapshot(db);
    // Validate raw data before any normalizer has an opportunity to drop a row or person.
    const preview = planPersonIdentity(
      originalSettings(snapshot),
      snapshot.rows,
    );
    assertIdentityOnlyChange(snapshot.rows, preview.rows);
    const hasBackup = snapshot.settings.length > 0 || snapshot.rows.length > 0;
    if (hasBackup) {
      await assertIntegrity(db);
      await ensureVerifiedBackup(db, snapshot);
    }
    await runIsolatedTransaction((tx) => writeMigration(tx, snapshot, preview, hasBackup));
    console.info("[Person identity migration] complete", {
      version: PERSON_IDENTITY_VERSION,
      splitCount: snapshot.rows.length,
      durationMs: Date.now() - started,
    });
  });
}
