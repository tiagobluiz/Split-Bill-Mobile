import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
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
) {
  if (JSON.stringify(await readSnapshot(tx)) !== JSON.stringify(snapshot))
    throw new Error("Data changed during migration preparation");
  const plan = planPersonIdentity(originalSettings(snapshot), snapshot.rows);
  assertIdentityOnlyChange(snapshot.rows, plan.rows);
  await tx.runAsync(
    "INSERT INTO app_settings (key, payload) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload",
    ["app-settings", JSON.stringify(plan.settings)],
  );
  await tx.runAsync("DELETE FROM split_person_memberships");
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
        backup: PERSON_IDENTITY_BACKUP,
      }),
    ],
  );
}

export async function migratePersonIdentity() {
  return withDatabaseWrite(async (db) => {
    await db.execAsync(`${MEMBERSHIP_SCHEMA}
      CREATE TABLE IF NOT EXISTS identity_migrations (version INTEGER PRIMARY KEY NOT NULL, completed_at TEXT NOT NULL, audit TEXT NOT NULL);`);
    const completed = await db.getFirstAsync<{ version: number }>(
      "SELECT version FROM identity_migrations WHERE version = ?",
      [PERSON_IDENTITY_VERSION],
    );
    if (completed) {
      await verifyPersonMemberships(db);
      return;
    }
    const started = Date.now();
    const snapshot = await readSnapshot(db);
    // Validate raw data before any normalizer has an opportunity to drop a row or person.
    const preview = planPersonIdentity(
      originalSettings(snapshot),
      snapshot.rows,
    );
    assertIdentityOnlyChange(snapshot.rows, preview.rows);
    await assertIntegrity(db);
    await ensureVerifiedBackup(db, snapshot);
    await runIsolatedTransaction((tx) => writeMigration(tx, snapshot));
    await verifyPersonMemberships(db);
    console.info("[Person identity migration] complete", {
      version: PERSON_IDENTITY_VERSION,
      splitCount: snapshot.rows.length,
      durationMs: Date.now() - started,
    });
  });
}
