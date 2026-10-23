import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "split-bill-mobile.db";
const MAX_RETRY_ATTEMPTS = 2;
const DATABASE_OPEN_OPTIONS: SQLite.SQLiteOpenOptions = {
  enableChangeListener: false,
  finalizeUnusedStatementsBeforeClosing: true,
  libSQLOptions: undefined,
  useNewConnection: false,
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getAppDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(
      DATABASE_NAME,
      DATABASE_OPEN_OPTIONS,
    ).then(async (db) => {
      await db.execAsync("PRAGMA foreign_keys = ON");
      return db;
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

let writeQueue: Promise<unknown> = Promise.resolve();

/** Serialize app writes; retry complete transactions, never individual statements. */
export function withDatabaseWrite<T>(operation: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const pending = writeQueue.catch(() => undefined).then(() => withAppDatabaseRetry(operation));
  writeQueue = pending.catch(() => undefined);
  return pending;
}

export function withDatabaseTransaction<T>(operation: (tx: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  return withDatabaseWrite(() => runIsolatedTransaction(operation));
}

/** Foreign keys must be enabled on the transaction's own connection, before BEGIN. */
export async function runIsolatedTransaction<T>(operation: (tx: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const tx = await SQLite.openDatabaseAsync(DATABASE_NAME, { ...DATABASE_OPEN_OPTIONS, useNewConnection: true });
  try {
    await tx.execAsync("PRAGMA foreign_keys = ON; BEGIN IMMEDIATE");
    try {
      const result = await operation(tx);
      await tx.execAsync("COMMIT");
      return result;
    } catch (error) {
      await tx.execAsync("ROLLBACK").catch(() => undefined);
      throw error;
    }
  } finally {
    // A cleanup failure must not turn a committed write into a failed save/retry.
    await tx.closeAsync().catch(() => console.warn("[SQLite] Could not close transaction connection"));
  }
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
