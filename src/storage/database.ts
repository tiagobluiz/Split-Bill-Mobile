import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "split-bill-mobile.db";
const MAX_RETRY_ATTEMPTS = 2;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getAppDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

function isRetryableSqliteHandleError(error: unknown) {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  return (
    message.includes("nativedatabase.prepareasync") ||
    message.includes("nullpointerexception")
  );
}

async function resetDatabaseHandle(
  db: SQLite.SQLiteDatabase,
  expectedPromise: Promise<SQLite.SQLiteDatabase>,
) {
  const maybeClose = (db as { closeAsync?: () => Promise<void> }).closeAsync;
  if (typeof maybeClose === "function") {
    try {
      await maybeClose.call(db);
    } catch {
      // Ignore close failures and force a fresh open below.
    }
  }
  if (databasePromise === expectedPromise) {
    databasePromise = null;
  }
}

/**
 * Runs a SQLite operation against the shared app database and retries once when
 * Expo SQLite reports a stale native handle.
 *
 * Keep operations idempotent/retry-safe because the callback may execute twice.
 */
export async function withAppDatabaseRetry<T>(
  operation: (db: SQLite.SQLiteDatabase) => Promise<T>,
) {
  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    const dbPromise = getAppDatabase();
    const db = await dbPromise;
    try {
      return await operation(db);
    } catch (error) {
      const canRetry =
        attempt < MAX_RETRY_ATTEMPTS && isRetryableSqliteHandleError(error);
      if (!canRetry) {
        throw error;
      }
      await resetDatabaseHandle(db, dbPromise);
    }
  }
  throw new Error("SQLite operation retry loop terminated unexpectedly.");
}
